// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: use sessionStorage.POLL_ACTIVE instead of localStorage?
// That was I do not perma-lock-out polling in event of an error
// during poll.

'use strict';

var lucu = lucu || {};

lucu.poll = {};

lucu.poll.active = false;

lucu.poll.start = function() {

  if(lucu.poll.active) {
    console.debug('Poll already in progress');
    return;
  }

  if(window && window.navigator && !window.navigator.onLine) {
    console.debug('Cannot poll while offline');
    return;
  }

  lucu.poll.active = true;

  // TODO: i think the trick to moving out the nested functions is
  // to make these variables bindable. But these are passed by value (copied), and
  // are effectively immutable state, because changing these values inside the later
  // functions just updates each function's local copy, and not desired variable.
  // By shoving these into an object, I can pass it around like a token that
  // represents shared state. Call it something like 'context' or 'pollProgress'

  // For that matter, we could treat context as the 'thisArg' parameter to
  // the bind function, and have the later functions just use this. to access
  // context, instead of making it an explicit argument. We just need to
  //  make sure that all the later functions are properly bound and not
  // trying to use 'this' for other purposes, or implicitly rebinding this
  // to something else.

  // All this is basically doing is changing the implied closure access
  // in the nested functions to the variables defined in this main function
  // scope into an explicit access against an explicit environment.

  // NOTE: this approach to using a custom env works as demonstrated in
  // fetch.js so it should not be too difficult to change this code to
  // use custom contexts. Something like
  // var env = {totalEntriesAdded, feedCounter, totalEntriesProcessed}

  var totalEntriesAdded = 0;
  var feedCounter = 0;
  var totalEntriesProcessed = 0;

  var getAll = lucu.poll.getAllFeeds.bind(this, onGetAllFeeds);
  lucu.database.open(getAll);

  // TODO: move function out of here
  function onGetAllFeeds(feeds) {
    feedCounter = feeds.length;
    if(feedCounter === 0) {
      return pollCompleted();
    }

    // TODO: move function out of here
    // NOTE: if we put feed as final arg, we can just bind directly
    feeds.forEach(function(feed) {
      lucu.poll.fetchAndUpdateFeed(feed, onFeedProcessed, onFeedProcessed);
    });
  }

  // TODO: move function out of here
  function onFeedProcessed(processedFeed, entriesProcessed, entriesAdded) {
    totalEntriesProcessed += entriesProcessed || 0;
    totalEntriesAdded += entriesAdded || 0;
    feedCounter--;
    if(feedCounter < 1) {
      pollCompleted();
    }
  }

  // TODO: move function out of here
  function pollCompleted() {
    lucu.poll.active = false;
    localStorage.LAST_POLL_DATE_MS = String(Date.now());

    chrome.runtime.sendMessage({
      type: 'pollCompleted',
      feedsProcessed: feedCounter,
      entriesAdded: totalEntriesAdded,
      entriesProcessed: totalEntriesProcessed
    });
  }
};

lucu.poll.getAllFeeds = function(onComplete, db) {
  lucu.feed.getAll(db, onComplete);
};

// Fetches and updates the local feed.
lucu.poll.fetchAndUpdateFeed = function(localFeed, oncomplete, onerror) {

  var args = {};
  args.url = localFeed.url;
  args.oncomplete = lucu.poll.onFetchFeed.bind(this, localFeed, oncomplete);
  args.onerror = onerror;

  // TODO: timeout and entryTimeout should be derived
  // from feed properties, not hardcoded
  args.timeout = 20 * 1000;
  args.entryTimeout = 20 * 1000;
  args.augmentEntries = true;
  lucu.feed.fetch(args);
};

lucu.poll.onFetchFeed = function(localFeed, onComplete, remoteFeed) {
  remoteFeed.fetched = Date.now();
  lucu.database.open(lucu.poll.updateFeed.bind(this, localFeed,
    remoteFeed, onComplete));
};

// A private helper function that exists primarily because of argument
// order to support late binding
lucu.poll.updateFeed = function(localFeed, remoteFeed, onComplete, db) {
  lucu.feed.update(db, localFeed, remoteFeed, onComplete);
};

lucu.poll.unlock = function() {
  //delete localStorage.POLL_ACTIVE;
  lucu.poll.active = false;
};
