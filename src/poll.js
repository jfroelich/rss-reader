// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: use sessionStorage.POLL_ACTIVE instead of localStorage?
// That was I do not perma-lock-out polling in event of an error
// during poll.


'use strict';

function resetPollActive() {
  delete localStorage.POLL_ACTIVE;
}

function startPolling() {

  var isPollRunning = localStorage.POLL_ACTIVE;

  if(isPollRunning) {
    console.debug('Poll already in progress');
    return;
  }

  // console.log('Starting poll');

  if(!navigator.onLine) {
    console.debug('Cannot poll while offline');
    return;
  }

  localStorage.POLL_ACTIVE = '1';

  var totalEntriesAdded = 0, feedCounter = 0, totalEntriesProcessed = 0;
  var feedCounter = 0;

  lucu.database.open(function(db) {
    getAllFeeds(db, onGetAllFeeds);
  });

  function onGetAllFeeds(feeds) {
    feedCounter = feeds.length;
    if(feedCounter === 0) {
      return pollCompleted();
    }

    feeds.forEach(function(feed) {
      pollFeed(feed, onFeedProcessed, onFeedProcessed);
    });
  }

  function onFeedProcessed(processedFeed, entriesProcessed, entriesAdded) {
    totalEntriesProcessed += entriesProcessed || 0;
    totalEntriesAdded += entriesAdded || 0;
    feedCounter--;
    if(feedCounter < 1) {
      pollCompleted();
    }
  }

  function pollCompleted() {
    delete localStorage.POLL_ACTIVE;
    localStorage.LAST_POLL_DATE_MS = String(Date.now());

    chrome.runtime.sendMessage({
      type: 'pollCompleted',
      feedsProcessed: feedCounter,
      entriesAdded: totalEntriesAdded,
      entriesProcessed: totalEntriesProcessed
    });
  }
}


// Fetches and updates the local feed.
function pollFeed(localFeed, oncomplete, onerror) {

  // TODO: timeout and entryTimeout should be derived
  // from feed properties

  // console.log('Polling %s', localFeed.title);

  lucu.feed.fetch({
    url: localFeed.url,
    oncomplete: onFetch,
    onerror: onerror,
    timeout: 20 * 1000,
    entryTimeout: 20 * 1000,
    augmentImageData: true,
    augmentEntries: true,
    rewriteLinks: true
  });

  function onFetch(remoteFeed) {
    remoteFeed.fetched = Date.now();

    lucu.database.open(function(db) {
      updateFeed(db, localFeed, remoteFeed, oncomplete);
    });
  }
}
