// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};
lucu.pollActive = false;
lucu.pollFeeds = function() {
  'use strict';

  console.log('Starting poll');

  if(lucu.pollActive) {
    console.debug('Poll already in progress');
    return;
  }

  if(navigator && !navigator.onLine) {
    console.debug('Cannot poll while offline');
    return;
  }

  lucu.pollActive = true;

  var totalEntriesAdded = 0;
  var feedCounter = 0;
  var totalEntriesProcessed = 0;

  lucu.database.open(function(db) {
    lucu.feed.getAll(db, function (feeds) {
      feedCounter = feeds.length;
      if(feedCounter === 0) {
        return pollCompleted();
      }

      feeds.forEach(function(localFeed) {
        function onFetch(remoteFeed) {
          remoteFeed.fetched = Date.now();
          lucu.database.open(function(db) {
            lucu.feed.update(db, localFeed, remoteFeed, onFeedProcessed);
          });
        }

        // catch exception??

        lucu.fetchFeed({
          url: localFeed.url,
          oncomplete: onFetch,
          onerror: onFeedProcessed,
          timeout: 20 * 1000,
          entryTimeout: 20 * 1000,
          fetchFullArticles: true
        });
      });
    });
  });

  function onFeedProcessed(processedFeed, entriesProcessed, entriesAdded) {
    totalEntriesProcessed += entriesProcessed || 0;
    totalEntriesAdded += entriesAdded || 0;
    feedCounter--;
    if(feedCounter < 1) {
      pollCompleted();
    }
  }

  function pollCompleted() {
    lucu.pollActive = false;
    localStorage.LAST_POLL_DATE_MS = String(Date.now());

    chrome.runtime.sendMessage({
      type: 'pollCompleted',
      feedsProcessed: feedCounter,
      entriesAdded: totalEntriesAdded,
      entriesProcessed: totalEntriesProcessed
    });
  }
};
