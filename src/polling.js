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

  var waterfall = [
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

  var message = {
    type: 'pollCompleted',
    feedsProcessed: feeds ? feeds.length : 0,
    entriesAdded: 0,
    entriesProcessed: 0
  };

  chrome.runtime.sendMessage(message);
};

// Simple helper to grab a db connection that is designed
// to work with async.js
// TODO: this should probably be a common function 
// from database.js
lucu.poll.connect = function(callback) {
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = function(event) {
    callback(null, event.target.result);
  };
};

lucu.poll.checkIdle = function(callback) {
  var isPermitted = lucu.poll.onCheckIdlePermission.bind(null, callback);
  chrome.permissions.contains({permissions: ['idle']}, isPermitted);
};

// checkIdle helper
lucu.poll.onCheckIdlePermission = function(callback, permitted) {
  // If we do not have permission to check idle status then
  // just continue with polling
  if(!permitted) {
    callback();
    return;
  }

  var isIdle = lucu.poll.isIdle.bind(null, callback);
  chrome.idle.queryState(lucu.poll.INACTIVITY_INTERVAL, isIdle);
};

// checkIdle helper
lucu.poll.isIdle = function(callback, idleState) {
  if(idleState == 'locked' || idleState == 'idle') {
    // Continue with polling by not passing an error
    callback();
  } else {
    // Pass back an error parameter that will cause the waterfall
    // to jump to end
    callback('poll error, idle state is ' + idleState);
  }
};

lucu.poll.selectFeeds = function(db, callback) {
  var feeds = [];
  var tx = db.transaction('feed');
  var store = tx.objectStore('feed');
  tx.oncomplete = lucu.poll.onSelectFeedsCompleted.bind(null, callback, 
    db, feeds);
  var request = store.openCursor();
  request.onsuccess = lucu.poll.onSelectFeed.bind(null, feeds);
};

// selectFeeds helper
lucu.poll.onSelectFeedsCompleted = function(callback, db, feeds, event) {
  callback(null, db, feeds);
};

// selectFeeds helper
lucu.poll.onSelectFeed = function(feeds, event) {
  var cursor = event.target.result;
  if(!cursor) return;
  feeds.push(cursor.value);
  cursor.continue();
};

lucu.poll.updateFeeds = function(db, feeds, callback) {
  var update = lucu.poll.updateFeed.bind(null, db);
  var onComplete = lucu.poll.onUpdateFeedsComplete.bind(null, callback, feeds);
  async.forEach(feeds, update, onComplete);
};

lucu.poll.onUpdateFeedsComplete = function(callback, feeds) {
  callback(null, feeds);
};

lucu.poll.updateFeed = function(db, feed, callback) {
  var onFetch = lucu.poll.onFetchFeed.bind(null, db, feed, callback);
  var onError = lucu.poll.onFetchError.bind(null, callback);
  var timeout = 10 * 1000; // in millis
  lucu.fetchFeed(feed.url, onFetch, onError, timeout);
};

lucu.poll.onFetchError = function(callback) {
  callback();
};

lucu.poll.onFetchFeed = function(db, feed, callback, remoteFeed) {
  // Filter duplicate entries from the set of just fetched entries
  var seenEntries = new Set();
  var isDistinct = lucu.poll.isDistinctFeedEntry.bind(null, seenEntries);
  remoteFeed.entries = remoteFeed.entries.filter(isDistinct);

  var onAugmentComplete = lucu.poll.onAugmentComplete.bind(null, 
    db, feed, remoteFeed, callback);
  remoteFeed.fetched = Date.now();
  lucu.augmentEntries(remoteFeed, onAugmentComplete);
};

lucu.poll.isDistinctFeedEntry = function(seenEntries, entry) {
  
  if(seenEntries.has(entry.link)) {
    console.debug('Filtering duplicate entry %o', entry);
    return false;
  }

  seenEntries.add(entry.link);
  return true;  
};

lucu.poll.onAugmentComplete = function(db, feed, remoteFeed, callback) {
  lucu.updateFeed(db, feed, remoteFeed, function() {
    callback();
  });
};

lucu.poll.onAlarm = function(alarm) {
  if(alarm.name == 'poll') {
    lucu.poll.start();
  }
};

chrome.alarms.onAlarm.addListener(lucu.poll.onAlarm);
chrome.alarms.create('poll', lucu.poll.SCHEDULE);
