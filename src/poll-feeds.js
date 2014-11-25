// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Polls feeds
 *
 * TODO: backoff if last poll did not find updated content?
 * TODO: backoff should be per feed
 * TODO: de-activation of feeds with 404s
 * TODO: de-activation of too much time elapsed since feed had new articles
 * TODO: only poll if feed is active
 */
lucu.pollFeeds = function(navigator) {

  async.waterfall([
    canCheckIdlePermission,
    canPollIfIdle,
    isOnline,
    openIndexedDB,
    selectAllFeeds,
    updateAllFeeds
  ], onWaterfallComplete);

  function canCheckIdlePermission(callback) {
    chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
      callback(null, permitted);
    });
  }

  function canPollIfIdle(canCheckIdle, callback) {
    // If we do not have permission to check idle status,
    // then simply continue with polling by not passing along
    // an error.
    if(!canCheckIdle) {
      return callback();
    }

    var INACTIVITY_INTERVAL = 60 * 5;
    chrome.idle.queryState(INACTIVITY_INTERVAL, function (idleState) {
      if(idleState == 'locked' || idleState == 'idle') {
        // Continue with polling by not passing an error
        callback();
      } else {
        // Pass back an error parameter that will cause the waterfall
        // to jump to end
        callback('polling error, not currently idle or locked');
      }
    });
  }

  function isOnline(callback) {
    if(navigator && !navigator.onLine) {
      return callback('offline');
    }

    callback();
  }

  function openIndexedDB(callback) {
    var request = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
    request.onerror = callback;
    request.onblocked = callback;
    request.onsuccess = function onSuccess(event) {
      callback(null, event.target.result);
    };
  }

  function selectAllFeeds(db, callback) {
    var feeds = [];
    var store = db.transaction('feed').objectStore('feed');
    store.openCursor().onsuccess = function (event) {
      var cursor = event.target.result;
      if(cursor) {
        feeds.push(cursor.value);
        cursor.continue();
      } else {
        callback(null, db, feeds);
      }
    };
  }

  function updateAllFeeds(db, feeds, callback) {
    async.forEach(feeds, function update(feed, callback) {
      lucu.fetchFeed(feed.url, function(remoteFeed) {
        lucu.augmentEntries(remoteFeed, function() {
          remoteFeed.fetched = Date.now();
          updateFeed(db, feed, remoteFeed, function() {
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

  // TODO: maybe inline this above
  // TODO: the caller should pass in last modified date of the remote xml file
  // so we can avoid pointless updates?
  // TODO: this should not be changing the date updated unless something
  // actually changed. However, we do want to indicate that the feed was
  // checked
  function updateFeed(db, localFeed, remoteFeed, oncomplete) {
    var clean = lucu.sanitizeFeed(remoteFeed);
    if(clean.title) localFeed.title = clean.title;
    if(clean.description) localFeed.description = clean.description;
    if(clean.link) localFeed.link = clean.link;
    if(clean.date) localFeed.date = clean.date;
    localFeed.fetched = remoteFeed.fetched;
    localFeed.updated = Date.now();
    var tx = db.transaction('feed','readwrite');
    var store = tx.objectStore('feed');
    var request = store.put(localFeed);
    request.onerror = console.debug;
    var mergeEntry = lucu.mergeEntry.bind(null, db, localFeed);
    request.onsuccess = function() {
      async.forEach(remoteFeed.entries, mergeEntry, oncomplete);
    };
  }

  function onWaterfallComplete(error, feeds) {
    if(error) {
      console.log('A polling error occurred');
      console.dir(error);
      return;
    }

    console.debug('Polling completed');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    chrome.runtime.sendMessage({
      type: 'pollCompleted',
      feedsProcessed: feeds ? feeds.length : 0,
      entriesAdded: 0,
      entriesProcessed: 0
    });
  }
};
