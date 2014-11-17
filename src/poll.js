// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

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

    // We can check idle status
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
      //var offlineError = new Error();
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

    // NOTE: by building an array here, we don't wait on fetches to complete
    // before advancing the cursor. This avoids the transaction closing
    // prematurely.

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
      function onUpdateCompleted(updatedFeed, entriesProcessed, entriesAdded) {
        callback();
      }

      var params = {};
      params.url = feed.url;
      params.timeout = 20 * 1000;
      params.entryTimeout = 20 * 1000;
      params.fetchFullArticles = true;

      params.oncomplete = function (remoteFeed) {
        remoteFeed.fetched = Date.now();
        lucu.feed.update(db, feed, remoteFeed, onUpdateCompleted);
      };

      params.onerror = function () {
        callback();
      };

      lucu.fetchFeed(params);
    }, function() {
      callback(null, feeds);
    });
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
