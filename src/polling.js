// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Polls feeds
 *
 * TODO: split this up into individual functions in the lucu
 * namespace so that it is easier to read and manage
 *
 * TODO: backoff if last poll did not find updated content?
 * TODO: backoff should be per feed
 * TODO: de-activation of feeds with 404s
 * TODO: de-activation of too much time elapsed since feed had new articles
 * TODO: only poll if feed is active
 */
lucu.pollFeeds = function(navigator) {

  if(lucu.isOffline(navigator)) {
  	return;
  }

  var functions = [
    lucu.canPollIfIdle,
    lucu.pollOpenIndexedDB,
    lucu.selectAllFeeds,
    lucu.pollUpdateAllFeeds
  ];

  async.waterfall(functions, lucu.pollWaterfallComplete);
};

lucu.isOffline = function(navigator) {
  if(navigator && navigator.hasOwnProperty('onLine') &&
    !navigator.onLine) {
    return true;
  }
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
  var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  request.onerror = callback;
  request.onblocked = callback;
  request.onsuccess = function onSuccess(event) {
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
