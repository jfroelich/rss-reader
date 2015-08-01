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

  if(navigator && navigator.hasOwnProperty('onLine') &&
    !navigator.onLine) {
    return;
  }

  async.waterfall([
    canPollIfIdle,
    openIndexedDB,
    lucu.selectAllFeeds,
    updateAllFeeds
  ], function (error, feeds) {
    console.debug('Polling completed');

    if(error) {
      console.dir(error);
      return;
    }

    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    chrome.runtime.sendMessage({
      type: 'pollCompleted',
      feedsProcessed: feeds ? feeds.length : 0,
      entriesAdded: 0,
      entriesProcessed: 0
    });
  });

  function canPollIfIdle(callback) {
    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {

      // If we do not have permission to check idle status then
      // just continue with polling
      if(!permitted) {
        return callback();
      }

      var INACTIVITY_INTERVAL = 60 * 5;
      chrome.idle.queryState(INACTIVITY_INTERVAL, pollIfIdle);
    });

    function pollIfIdle(idleState) {
      if(idleState == 'locked' || idleState == 'idle') {
        // Continue with polling by not passing an error
        callback();
      } else {
        // Pass back an error parameter that will cause the waterfall
        // to jump to end
        callback('state is ' + idleState);
      }
    }
  }

  function openIndexedDB(callback) {
    var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
    request.onerror = callback;
    request.onblocked = callback;
    request.onsuccess = function onSuccess(event) {
      callback(null, event.target.result);
    };
  }

  function updateAllFeeds(db, feeds, callback) {
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
  }
};
