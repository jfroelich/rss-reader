// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file


// Polling lib for periodically updating feeds
// TODO: customizable update schedules per feed
// TODO: backoff per feed if poll did not find updated content
// TODO: de-activation of feeds with 404s
// TODO: de-activation of too much time elapsed since feed had new articles
// TODO: only poll if feed is active

chrome.alarms.onAlarm.addListener(function(alarm) {
  'use strict';
  if(alarm.name == 'poll') {
    pollFeeds();
  }
});

chrome.alarms.create('poll', {periodInMinutes: 20});

function pollFeeds() {
  'use strict';

  if(lucu.browser.isOffline()) {
    return;
  }

  const IDLE_PERIOD = 60 * 5; // seconds

  lucu.browser.queryIdleState(IDLE_PERIOD, function(state) {
    if(!state || state === 'locked' || state === 'idle') {
      openDatabaseConnection(selectFeeds);
    } else {
      onComplete();
    }
  });

  function selectFeeds(error, connection) {
    if(error) {
      console.debug(error);
      onComplete();
      return;
    }

    lucu.feed.selectFeeds(connection, onSelectFeeds.bind(null, connection));
  }

  function onSelectFeeds(connection, feeds) {
    async.forEach(feeds, fetchFeed.bind(null, connection), 
      onComplete);
  }

  function fetchFeed(connection, feed, callback) {
    const timeout = 10 * 1000;
    lucu.feed.fetch(feed.url, timeout, onFetch);

    function onFetch(event, remoteFeed) {
      if(event) {
        console.dir(event);
        callback();
        return;
      }

      lucu.feed.put(connection, feed, remoteFeed, 
        onPutFeed.bind(null, remoteFeed));
    }

    function onPutFeed(remoteFeed, event) {
      async.forEach(remoteFeed.entries, 
        findEntryByLink.bind(null, connection, feed), callback);
    }
  }

  function findEntryByLink(connection, feed, entry, callback) {
    lucu.entry.findByLink(connection, entry, onFind);

    function onFind(event) {
      if(event.target.result) {
        callback();
      } else {
        lucu.entry.augment(entry, onAugment);
      }
    }

    function onAugment() {
      lucu.entry.put(connection, feed, entry, callback);
    }
  }

  function onComplete() {
    console.debug('Polling completed');
    localStorage.LAST_POLL_DATE_MS = String(Date.now());
    const message = {
      type: 'pollCompleted'
    };

    chrome.runtime.sendMessage(message);
    lucu.browser.updateBadge();
    lucu.notifications.show('Updated articles');
  }
}
