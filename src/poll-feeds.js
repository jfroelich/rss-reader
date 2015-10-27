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
  if(!window.navigator.onLine) {
    return;
  }
  const IDLE_PERIOD = 60 * 5; // in seconds
  queryIdleState(IDLE_PERIOD, function(state) {
    if(!state || state === 'locked' || state === 'idle') {
      openDatabaseConnection(iterateFeeds);
    } else {
      onComplete();
    }
  });

  function iterateFeeds(error, connection) {
    if(error) {
      console.debug(error);
      onComplete();
      return;
    }

    forEachFeed(connection, pollFetchFeed.bind(null, connection), 
      false, onComplete);
  }

  function pollFetchFeed(connection, feed) {
    const timeout = 10 * 1000;
    fetchFeed(feed.url, timeout, onFetch);

    function onFetch(event, remoteFeed) {
      if(event) {
        console.dir(event);
        return;
      }

      putFeed(connection, feed, remoteFeed, 
        onPutFeed.bind(null, remoteFeed));
    }

    function onPutFeed(remoteFeed, event) {
      async.forEach(remoteFeed.entries, 
        pollFindEntryByLink.bind(null, connection, feed), 
        function(){});
    }
  }

  function pollFindEntryByLink(connection, feed, entry, callback) {
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

  function onComplete() {
    console.debug('Polling completed');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    // const message = {type: 'pollCompleted'};
    // chrome.runtime.sendMessage(message);
    updateBadge();
    showNotification('Updated articles');
  }
}
