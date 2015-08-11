// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/*
 * TODO: split this up into individual functions in the lucu
 * namespace so that it is easier to read and manage
 * TODO: use lucu.poll namespace
 * TODO: support customizable poll timing per feed
 * TODO: backoff if last poll did not find updated content?
 * TODO: backoff should be per feed
 * TODO: de-activation of feeds with 404s
 * TODO: de-activation of too much time elapsed since feed had new articles
 * TODO: only poll if feed is active
*/

// Polls feeds
// TODO: is requiring navigator as a parameter here stupid?
lucu.pollFeeds = function() {

  if(lucu.isOffline()) {
  	return;
  }

  var waterfall = [
    lucu.canPollIfIdle,
    lucu.pollOpenIndexedDB,
    lucu.pollSelectAllFeeds,
    lucu.pollUpdateAllFeeds
  ];

  async.waterfall(waterfall, lucu.pollWaterfallComplete);
};

lucu.isOffline = function() {
  var nav = window && window.navigator;
  return nav && nav.hasOwnProperty('onLine') && !nav.onLine;
};

lucu.pollWaterfallComplete = function(error, feeds) {
  console.debug('Polling completed');

  if(error) {
    console.dir(error);
    return;
  }

  localStorage.LAST_POLL_DATE_MS = String(Date.now());

  var msg = {
    type: 'pollCompleted',
    feedsProcessed: feeds ? feeds.length : 0,
    entriesAdded: 0,
    entriesProcessed: 0
  };

  chrome.runtime.sendMessage(msg);
};

// Simple helper to grab a db connection that is designed
// to work with async.js
// TODO: this should probably be a common function 
// from database.js
lucu.pollOpenIndexedDB = function(callback) {
  var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = function(event) {
    callback(null, event.target.result);
  };
};

// Idle if greater than or equal to this many seconds
lucu.POLL_INACTIVITY_INTERVAL = 60 * 5;

lucu.canPollIfIdle = function(callback) {
  chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
  	// If we do not have permission to check idle status then
  	// just continue with polling
  	if(!permitted) {
  	  return callback();
  	}

  	chrome.idle.queryState(lucu.POLL_INACTIVITY_INTERVAL, checkIdle);
  });

  function checkIdle(idleState) {
	if(idleState == 'locked' || idleState == 'idle') {
	  // Continue with polling by not passing an error
	  callback();
	} else {
	  // Pass back an error parameter that will cause the waterfall
	  // to jump to end
	  callback('poll error, idle state is ' + idleState);
	}
  }
};


lucu.pollSelectAllFeeds = function(db, callback) {
  var feeds = [];
  var store = db.transaction('feed').objectStore('feed');
  store.openCursor().onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      callback(null, db, feeds);
    }
  };
};

// TODO: break this apart into separate functions more
lucu.pollUpdateAllFeeds = function(db, feeds, callback) {
  async.forEach(feeds, function(feed, callback) {
    lucu.fetchFeed(feed.url, function(remoteFeed) {

      // Filter duplicate entries
      var seenEntries = new Set();
      remoteFeed.entries = remoteFeed.entries.filter(function(entry) {
      if(seenEntries.has(entry.link)) {
          console.debug('Filtering duplicate entry %o', entry);
          return false;
        }
        seenEntries.add(entry.link);
        return true;
      });

      // Side note: why am i updating the feed after updating
      // entries? Why not before? Why not separately or in parallel

      lucu.augmentEntries(remoteFeed, function() {
        remoteFeed.fetched = Date.now();
        lucu.updateFeed(db, feed, remoteFeed, function() {
          callback();
        });
      });
    }, function () {
      callback();
    }, 10 * 1000);
  }, function() {
    callback(null, feeds);
  });
};


lucu.pollOnAlarm = function(alarm) {
  if(alarm.name == 'poll') {
    lucu.pollFeeds();
  }
};

lucu.POLL_SCHEDULE = {periodInMinutes: 20};
chrome.alarms.onAlarm.addListener(lucu.pollOnAlarm);
chrome.alarms.create('poll', lucu.POLL_SCHEDULE);
