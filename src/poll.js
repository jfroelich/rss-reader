// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Polling lib (for periodically updating feeds)
lucu.poll = {};

// Idle if greater than or equal to this many seconds
lucu.poll.INACTIVITY_INTERVAL = 60 * 5;

// Amount of minutes between polls
lucu.poll.SCHEDULE = {periodInMinutes: 20};

/**
 * TODO: support customizable poll timing per feed
 * TODO: backoff if last poll did not find updated content?
 * TODO: backoff should be per feed
 * TODO: de-activation of feeds with 404s
 * TODO: de-activation of too much time elapsed since feed had new articles
 * TODO: only poll if feed is active
 * Side note: why am i updating the feed after updating
 * entries? Why not before? Why not separately or in parallel
 */

// Start the polling sequence
lucu.poll.start = function() {

  if(lucu.isOffline()) {
  	return;
  }

  const waterfall = [
    lucu.poll.checkIdle,
    lucu.poll.connect,
    lucu.poll.selectFeeds,
    lucu.poll.updateFeeds
  ];

  async.waterfall(waterfall, lucu.poll.onComplete);
};

lucu.poll.onComplete = function(error, feeds) {
  console.debug('Polling completed');

  if(error) {
    console.dir(error);
    return;
  }

  localStorage.LAST_POLL_DATE_MS = String(Date.now());

  // Notify other modules that the poll completed. For example, the slides
  // view may want to pre-load some of the newly available articles
  const message = {
    type: 'pollCompleted',
    feedsProcessed: feeds ? feeds.length : 0,
    entriesAdded: 0,
    entriesProcessed: 0
  };

  chrome.runtime.sendMessage(message);

  // Update the app badge to reflect that there may be new unread articles
  // TODO: only call this if entriesAdded is not 0
  lucu.badge.update();
  
  // Display a notification
  // TODO: only call this if entriesAdded is not 0, and also show the number
  // of articles added in the message
  lucu.notifications.show('Updated articles');
};

lucu.poll.checkIdle = function(callback) {
  'use strict';
  var isPermitted = lucu.poll.onCheckIdlePermission.bind(null, callback);
  chrome.permissions.contains({permissions: ['idle']}, isPermitted);
};

// checkIdle helper
lucu.poll.onCheckIdlePermission = function(callback, permitted) {
  'use strict';
  // If we do not have permission to check idle status then
  // just continue with polling
  if(!permitted) {
    callback();
    return;
  }

  const isIdle = lucu.poll.isIdle.bind(null, callback);
  chrome.idle.queryState(lucu.poll.INACTIVITY_INTERVAL, isIdle);
};

// checkIdle helper
lucu.poll.isIdle = function(callback, idleState) {
  'use strict';
  if(idleState == 'locked' || idleState == 'idle') {
    // Continue with polling by not passing an error
    callback();
  } else {
    // Pass back an error parameter that will cause the waterfall
    // to jump to end
    callback('poll error, idle state is ' + idleState);
  }
};

// TODO: maybe rename to be clearer?
lucu.poll.connect = function(callback) {
  'use strict';
  const onConnect = lucu.poll.onConnect.bind(null, callback);
  lucu.database.connect(onConnect, callback);
};

// TODO: deprecate, use async.waterfall
lucu.poll.onConnect = function(callback, error, database) {
  'use strict';
  callback(null, database);
};

lucu.poll.selectFeeds = function(database, callback) {
  'use strict';
  const feeds = [];
  const transaction = database.transaction('feed');
  const store = transaction.objectStore('feed');
  transaction.oncomplete = lucu.poll.onSelectFeedsCompleted.bind(null, 
    callback, database, feeds);
  const request = store.openCursor();
  request.onsuccess = lucu.poll.onSelectFeed.bind(null, feeds);
};

// selectFeeds helper
lucu.poll.onSelectFeedsCompleted = function(callback, database, feeds, event) {
  'use strict';
  callback(null, database, feeds);
};

// selectFeeds helper
lucu.poll.onSelectFeed = function(feeds, event) {
  'use strict';
  const cursor = event.target.result;
  if(!cursor) return;
  feeds.push(cursor.value);
  cursor.continue();
};

lucu.poll.updateFeeds = function(database, feeds, callback) {
  'use strict';
  const update = lucu.poll.updateFeed.bind(null, database);
  const onComplete = lucu.poll.onUpdateFeedsComplete.bind(null, callback, 
    feeds);
  async.forEach(feeds, update, onComplete);
};

lucu.poll.onUpdateFeedsComplete = function(callback, feeds) {
  'use strict';
  callback(null, feeds);
};

lucu.poll.updateFeed = function(database, feed, callback) {
  'use strict';
  const onFetch = lucu.poll.onFetchFeed.bind(null, database, feed, callback);
  const onError = lucu.poll.onFetchError.bind(null, callback);
  const timeout = 10 * 1000; // in millis
  lucu.fetch.fetchFeed(feed.url, onFetch, onError, timeout);
};

lucu.poll.onFetchError = function(callback) {
  'use strict';
  callback();
};

lucu.poll.onFetchFeed = function(database, feed, callback, remoteFeed) {
  'use strict';
  // TODO: should this occur here? is this redundant?
  remoteFeed.entries = remoteFeed.entries.filter(function(entry) {
    return entry.link;
  });

  // Filter duplicate entries from the set of just fetched entries
  const seenEntries = new Set();
  const isDistinct = lucu.poll.isDistinctFeedEntry.bind(null, seenEntries);
  remoteFeed.entries = remoteFeed.entries.filter(isDistinct);

  const onAugmentComplete = lucu.poll.onAugmentComplete.bind(null, 
    database, feed, remoteFeed, callback);
  remoteFeed.fetched = Date.now();
  lucu.augment.start(remoteFeed, onAugmentComplete);
};

lucu.poll.isDistinctFeedEntry = function(seenEntries, entry) {
  'use strict';
  if(seenEntries.has(entry.link)) {
    console.debug('Filtering duplicate entry %o', entry);
    return false;
  }

  seenEntries.add(entry.link);
  return true;  
};

lucu.poll.onAugmentComplete = function(database, feed, remoteFeed, callback) {
  'use strict';
  // TODO: if we do end up updating the feed, what about the functional
  // dependencies such as the feedTitle and feedLink properties set for 
  // entries already in the database?

  // TODO: should check last modified date of the remote xml file
  // so we can avoid pointless updates?
  // TODO: this should not be changing the date updated unless something
  // actually changed. However, we do want to indicate that the feed was
  // checked
  const cleanedRemoteFeed = lucu.sanitizeFeed(remoteFeed);

  // We plan to update the local feed object. Overwrite its properties with
  // new properties from the remote feed

  if(cleanedRemoteFeed.title) {
    feed.title = cleanedRemoteFeed.title;
  }

  if(cleanedRemoteFeed.description) {
    feed.description = cleanedRemoteFeed.description;
  }

  if(cleanedRemoteFeed.link) {
    feed.link = cleanedRemoteFeed.link;
  }

  if(cleanedRemoteFeed.date) {
    feed.date = cleanedRemoteFeed.date;
  }

  // Transfer the fetch date
  feed.fetched = remoteFeed.fetched;

  // Set the date updated
  feed.updated = Date.now();

  // TODO: there is a lot of similarity to addFeed here. and IDBObjectStore.put
  // can work like IDBObjectStore.add. I think the two should be merged into 
  // the same function

  // Overwrite the old local feed object with the modified local feed object
  const transaction = database.transaction('feed', 'readwrite');
  const feedStore = transaction.objectStore('feed');
  const putFeedRequest = feedStore.put(feed);
  putFeedRequest.onerror = console.debug;

  // TODO: move this into separate function
  putFeedRequest.onsuccess = function() {
    // Now merge in any new entries from the remote feed
    // NOTE: i don't think it matters whether we pass feed or 
    // remoteFeed or cleanedRemoteFeed to mergeEntry
    const mergeEntry = lucu.entry.merge.bind(null, database, feed);
    const entries = remoteFeed.entries;

    // We have to wrap so that we call callback without parameters
    // due to async lib behavior
    function onMergeEntriesComplete() {
      callback();
    }

    // TODO: this is in parallel, right?
    async.forEach(entries, mergeEntry, onMergeEntriesComplete);
  };
};

lucu.poll.onAlarm = function(alarm) {
  'use strict';
  if(alarm.name == 'poll') {
    lucu.poll.start();
  }
};

chrome.alarms.onAlarm.addListener(lucu.poll.onAlarm);
chrome.alarms.create('poll', lucu.poll.SCHEDULE);
