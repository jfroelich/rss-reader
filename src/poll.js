// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/*
TODO: customizable update schedules per feed
TODO: backoff per feed if poll did not find updated content
TODO: de-activation of feeds with 404s
TODO: de-activation of too much time elapsed since feed had new articles
TODO: only poll if feed is active
*/

var lucu = lucu || {};

// Polling lib for periodically updating feeds
lucu.poll = {};

// Start the polling sequence
lucu.poll.start = function() {
  'use strict';
  if(lucu.browser.isOffline()) {
  	return;
  }

  // Idle if greater than or equal to this many seconds
  const IDLE_PERIOD = 60 * 5;

  lucu.browser.queryIdleState(IDLE_PERIOD, function(state) {
    if(!state || state === 'locked' || state === 'idle') {
      lucu.database.connect(lucu.poll.selectFeeds, lucu.poll.onComplete);
    } else {
      lucu.poll.onComplete();
    }
  });
};

lucu.poll.selectFeeds = function(error, database) {
  'use strict';
  lucu.feed.selectFeeds(database, lucu.poll.fetchFeeds.bind(null, database));
};

lucu.poll.fetchFeeds = function(database, feeds) {
  'use strict';
  async.forEach(feeds, lucu.poll.fetchFeed.bind(null, database), 
    lucu.poll.onComplete);
};

lucu.poll.fetchFeed = function(database, feed, callback) {
  'use strict';
  
  function onFetch(remoteFeed) {
    lucu.feed.put(database, feed, remoteFeed, lucu.poll.onPutFeed.bind(
      null, database, feed, remoteFeed, callback));
  }

  function onError(event) {
    callback();
  }
  
  const timeout = 10 * 1000; // in millis
  lucu.feed.fetch(feed.url, onFetch, onError, timeout);
};

lucu.poll.onPutFeed = function(database, feed, remoteFeed, callback, 
  event) {
  'use strict';
  async.forEach(remoteFeed.entries, lucu.poll.findEntryByLink.bind(null, 
    database, feed), callback);
};

lucu.poll.findEntryByLink = function(database, feed, entry, callback) {
  'use strict';

  lucu.entry.findByLink(database, entry, onFind);

  function onFind(event) {
    if(event.target.result) {
      callback();
    } else {
      lucu.entry.augment(entry, onAugment);
    }
  }

  function onAugment() {
    lucu.entry.put(database, feed, entry, callback);
  }
};

lucu.poll.onComplete = function() {
  'use strict';
  console.debug('Polling completed');
  localStorage.LAST_POLL_DATE_MS = String(Date.now());
  const message = {
    type: 'pollCompleted'
  };

  chrome.runtime.sendMessage(message);
  lucu.browser.updateBadge();
  lucu.notifications.show('Updated articles');
};

lucu.poll.onAlarm = function(alarm) {
  'use strict';
  if(alarm.name == 'poll') {
    lucu.poll.start();
  }
};

// Amount of minutes between polls
lucu.poll.SCHEDULE = {periodInMinutes: 20};
chrome.alarms.onAlarm.addListener(lucu.poll.onAlarm);
chrome.alarms.create('poll', lucu.poll.SCHEDULE);
