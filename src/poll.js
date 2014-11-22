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
        lucu.updateFeed(db, feed, remoteFeed, onUpdateCompleted);
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


/**
 * Replaces the local feed object with the updated properties of remoteFeed,
 * then merges in any new entries present in the remoteFeed, and then calls
 * oncomplete.
 *
 * TODO: move this into the function above. This also means we eventually want
 * to clarify this function's dependencies.
 * TODO: the caller needs to set remoteFeed.fetched
 * TODO: the caller should pass in last modified
 * date of the remote xml file so we can avoid pointless updates
 * TODO: this should not be changing the date updated unless something actually
 * changed. However, we do want to indicate that the feed was checked
 */
lucu.updateFeed = function(db, localFeed, remoteFeed, oncomplete) {

  var cleanedFeed = lucu.sanitizeFeed(remoteFeed);

  if(cleanedFeed.title) {
    localFeed.title = cleanedFeed.title;
  }

  if(cleanedFeed.description) {
    localFeed.description = cleanedFeed.description;
  }

  if(cleanedFeed.link) {
    localFeed.link = cleanedFeed.link;
  }

  if(cleanedFeed.date) {
    localFeed.date = cleanedFeed.date;
  }

  localFeed.fetched = remoteFeed.fetched;
  localFeed.updated = Date.now();

  var putFeedTransaction = db.transaction('feed','readwrite');
  var feedStore = putFeedTransaction.objectStore('feed');
  var putFeedRequest = feedStore.put(localFeed);
  putFeedRequest.onerror = console.debug;
  putFeedRequest.onsuccess = lucu.mergeEntries.bind(this, db, localFeed,
    remoteFeed.entries, oncomplete);
};
