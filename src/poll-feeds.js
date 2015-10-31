// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: customizable update schedules per feed
// TODO: backoff per feed if poll did not find updated content
// TODO: de-activation of feeds with 404s
// TODO: de-activation of too much time elapsed since feed had new articles
// TODO: only poll if feed is active

function pollFeeds() {
  'use strict';
  
  console.debug('Polling feeds');

  if(!window.navigator.onLine) {
    console.debug('Polling canceled, not online');
    return;
  }

  chrome.permissions.contains({permissions: ['idle']}, function(permitted) {
    if(!permitted) {
      openDatabaseConnection(iterateFeeds);
      return;
    }
    const IDLE_PERIOD = 60 * 5; // 5 minutes
    chrome.idle.queryState(IDLE_PERIOD, onQueryIdleState);
  });

  function onQueryIdleState(state) {
    if(state === 'locked' || state === 'idle') {
      openDatabaseConnection(iterateFeeds);
    } else {
      console.debug('Polling canceled as not idle');
      onComplete();
    }
  }

  function iterateFeeds(event) {
    if(event.type !== 'success') {
      console.debug(event);
      onComplete();
      return;
    }

    // TODO: I need to use some async.* function that can trigger
    // a final callback once each feed has been processed
    // Kind of like async.until?
    // Or basically I may need to write forEachFeed to work like
    // async.forEach. Instead of binding its callback to 
    // transaction.oncomplete, I need to wait for all the callbacks
    // to callback
    forEachFeed(event.target.result, pollFetchFeed.bind(null, connection), 
      false, onComplete);
  }

  function pollFetchFeed(connection, feed) {
    const timeout = 10 * 1000;
    fetchFeed(feed.url, timeout, function(event, remoteFeed) {
      console.debug('Fetched %s', feed.url);
      if(event) {
        console.dir(event);
        return;
      }
      putFeed(connection, feed, remoteFeed, 
        onPutFeed.bind(null, remoteFeed));
    });

    function onPutFeed(remoteFeed, event) {
      async.forEach(remoteFeed.entries, 
        pollFindEntryByLink.bind(null, connection, feed), 
        onEntriesUpdated);
    }
  }

  // The issue is that this gets called per feed. I want to only call it 
  // when _everything_ is finished. We cannot do it with forEachFeed 
  // above because that fires off independent async calls and finishes
  // before waiting for them to complete, which it kind of has to because
  // we do not know the number of feeds in advance and I don't want to count
  // or preload all into an array.
  // Temporarily just update the badge for each feed processed
  function onEntriesUpdated() {
    updateBadge();
  }

  function pollFindEntryByLink(connection, feed, entry, callback) {
    console.debug('Processing entry %s', entry.link);
    findEntryByLink(connection, entry, function(event) {
      if(event.target.result) {
        callback();
      } else {
        const timeout = 20 * 1000;
        augmentEntryContent(entry, timeout, onAugment);
      }
    });

    function onAugment(errorEvent) {
      putEntry(connection, feed, entry, callback);
    }
  }

  // NOTE: due to above issues, this gets called when finished with 
  // iterating feeds, BUT prior to finishing entry processing
  function onComplete() {
    console.debug('Polling completed');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    // const message = {type: 'pollCompleted'};
    // chrome.runtime.sendMessage(message);
    showNotification('Updated articles');
  }
}
