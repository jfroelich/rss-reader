// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Polling lib for periodically updating feeds
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

  lucu.feed.put(database, feed, remoteFeed, function() {
    lucu.poll.onPutFeed(database, feed, remoteFeed.entries, callback);
  });
};

lucu.poll.onPutFeed = function(database, feed, entries, callback) {
  'use strict';

  // Now that the feed was updated, process the entries

  // Remove any entries without links
  // TODO: should this occur here or somewhere earlier? is this redundant?
  // Do we ever fetch a feed and not do this?
  entries = entries.filter(lucu.entry.hasLink);

  // Consolidate duplicate entries. Doing this now, synchronously, reduces
  // the number of indexedDB calls.
  const seenEntries = new Set();
  const isDistinct = lucu.poll.isDistinctFeedEntry.bind(null, seenEntries);
  entries = entries.filter(isDistinct);

  // Process the entries
  const findByLink = lucu.poll.findEntryByLink.bind(null, database, feed);
  async.forEach(entries, findByLink, callback);
};

lucu.poll.findEntryByLink = function(database, feed, entry, callback) {
  'use strict';
  const transaction = database.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const linkIndex = entryStore.index('link');
  const request = linkIndex.get(entry.link);
  request.onsuccess = lucu.poll.onFindEntry.bind(request, database, feed, 
    entry, callback);
  request.onerror = lucu.poll.onFindEntryError.bind(request, callback);
};

lucu.poll.onFindEntryError = function(callback, event) {
  'use strict';
  console.debug(event);
  callback();
};

lucu.poll.onFindEntry = function(database, feed, entry, callback, event) {
  'use strict';
  
  const onUpdate = lucu.poll.onEntryContentUpdated.bind(null, database, 
    feed, entry, callback);
  
  if(event.target.result) {
    callback();
  } else {
    lucu.augment.updateEntryContent(entry, onUpdate);
  }
};

lucu.poll.onEntryContentUpdated = function(database, feed, entry, callback) {
  'use strict';
  lucu.entry.merge(database, feed, entry, callback);
};

lucu.poll.isDistinctFeedEntry = function(seenEntries, entry) {
  'use strict';
  if(seenEntries.has(entry.link)) {
    return false;
  }

  seenEntries.add(entry.link);
  return true;  
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

lucu.poll.onAlarm = function(alarm) {
  'use strict';
  if(alarm.name == 'poll') {
    lucu.poll.start();
  }
};

chrome.alarms.onAlarm.addListener(lucu.poll.onAlarm);
chrome.alarms.create('poll', lucu.poll.SCHEDULE);
