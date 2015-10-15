// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Polling lib for periodically updating feeds
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
lucu.poll = {};

// Start the polling sequence
lucu.poll.start = function() {

  if(lucu.isOffline()) {
  	return;
  }

  // TODO: i am thinking waterfall should be deprecated

  const waterfall = [
    lucu.poll.checkIdle,
    lucu.poll.connect,
    lucu.poll.selectFeeds,
    lucu.poll.fetchFeeds
  ];

  async.waterfall(waterfall, lucu.poll.onComplete);
};

lucu.poll.checkIdle = function(callback) {
  'use strict';
  lucu.idle.queryState(lucu.poll.onCheckIdle.bind(null, callback));
};

lucu.poll.onCheckIdle = function(callback, state) {
  'use strict';
  if(!state || state === 'locked' || state === 'idle') {
    callback();
  } else {
    callback('Polling cancelled as not idle');
  }
};

// TODO: maybe rename to be clearer?
lucu.poll.connect = function(callback) {
  'use strict';
  const onConnect = lucu.poll.onConnect.bind(null, callback);
  lucu.database.connect(onConnect, callback);
};

lucu.poll.onConnect = function(callback, error, database) {
  'use strict';
  callback(null, database);
};

lucu.poll.selectFeeds = function(database, callback) {
  'use strict';
  lucu.feed.selectFeeds(database, lucu.poll.onSelectFeeds.bind(null,
    database, callback));
};

lucu.poll.onSelectFeeds = function(database, callback, feeds) {
  'use strict';
  callback(null, database, feeds);
};

lucu.poll.fetchFeeds = function(database, feeds, callback) {
  'use strict';

  async.forEach(feeds, lucu.poll.fetchFeed.bind(null, database), 
    lucu.poll.onFetchFeedsComplete.bind(null, callback, feeds));
};

lucu.poll.onFetchFeedsComplete = function(callback, feeds) {
  'use strict';
  callback(null, feeds);
};

lucu.poll.fetchFeed = function(database, feed, callback) {
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
  lucu.feed.put(database, feed, remoteFeed, lucu.poll.onPutFeed.bind(
    null, database, feed, remoteFeed, callback));
};

lucu.poll.onPutFeed = function(database, feed, remoteFeed, callback, 
  event) {
  'use strict';
  async.forEach(remoteFeed.entries, lucu.poll.findEntryByLink.bind(null, 
    database, feed), callback);
};

// TODO: create and use lucu.entry.findByLink instead

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
  
  if(event.target.result) {
    callback();
  } else {
    lucu.entry.augment(entry, 
      lucu.poll.onEntryContentUpdated.bind(null, database, feed, entry, 
        callback));
  }
};

lucu.poll.onEntryContentUpdated = function(database, feed, entry, callback) {
  'use strict';
  lucu.entry.put(database, feed, entry, callback);
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

// Amount of minutes between polls
lucu.poll.SCHEDULE = {periodInMinutes: 20};


chrome.alarms.onAlarm.addListener(lucu.poll.onAlarm);
chrome.alarms.create('poll', lucu.poll.SCHEDULE);
