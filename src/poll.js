// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Polling lib for periodically updating feeds
/**
 * TODO: support customizable poll timing per feed
 * TODO: backoff if last poll did not find updated content?
 * TODO: backoff should be per feed
 * TODO: de-activation of feeds with 404s
 * TODO: de-activation of too much time elapsed since feed had new articles
 * TODO: only poll if feed is active
 * Side note: why am i updating the feed after updating
 * entries? Why not before? Why not separately or in parallel
 */
lucu.poll = {};

// Start the polling sequence
lucu.poll.start = function() {

  if(lucu.isOffline()) {
  	return;
  }

  // TODO: i am thinking waterfall should be deprecated

  const waterfall = [
    lucu.poll.checkIdle,
    lucu.poll.connect,
    lucu.poll.selectFeeds,
    lucu.poll.fetchFeeds
  ];

  async.waterfall(waterfall, lucu.poll.onComplete);
};

lucu.poll.checkIdle = function(callback) {
  'use strict';
  lucu.idle.queryState(onCheck);

  function onCheck(state) {
    if(!state || state === 'locked' || state === 'idle') {
      callback();
    } else {
      callback('Polling cancelled as not idle');
    }
  }
};

lucu.poll.connect = function(callback) {
  'use strict';
  lucu.database.connect(function(error, database) {
    callback(null, database);
  }, callback);
};

lucu.poll.selectFeeds = function(database, callback) {
  'use strict';
  lucu.feed.selectFeeds(database, onSelect);

  function onSelect(feeds) {
    callback(null, database, feeds);
  }
};

lucu.poll.fetchFeeds = function(database, feeds, callback) {
  'use strict';
  async.forEach(feeds, lucu.poll.fetchFeed.bind(null, database), onComplete);
  function onComplete() {
    callback(null, feeds);
  }
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
  lucu.fetch.fetchFeed(feed.url, onFetch, onError, timeout);
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

lucu.poll.onComplete = function(error, feeds) {
  console.debug('Polling completed');

  if(error) {
    console.dir(error);
    return;
  }

  localStorage.LAST_POLL_DATE_MS = String(Date.now());

  // Notify other modules that the poll completed. For example, the slides
  // view may want to pre-load some of the newly available articles
  const message = {
    type: 'pollCompleted',
    feedsProcessed: feeds ? feeds.length : 0,
    entriesAdded: 0,
    entriesProcessed: 0
  };

  chrome.runtime.sendMessage(message);

  // Update the app badge to reflect that there may be new unread articles
  // TODO: only call this if entriesAdded is not 0
  lucu.badge.update();
  
  // Display a notification
  // TODO: only call this if entriesAdded is not 0, and also show the number
  // of articles added in the message
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
