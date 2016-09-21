// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.feed = rdr.feed || {};
rdr.feed.subscribe = {};

// @param feed a basic object representing a feed
// @param options {Object} optional object containing optional callback
// and optional open connection
rdr.feed.subscribe.start = function(feed, options) {
  const feedURLString = rdr.feed.getURL(feed);
  if(!feedURLString) {
    throw new TypeError('feed should always have at least one url');
  }
  console.log('Subscribing to', feedURLString);

  const context = {
    'feed': feed,
    'didSubscribe': false,
    'shouldCloseDB': false,
    'shouldNotify': true
  };

  if(options) {
    context.callback = options.callback;
    if(options.suppressNotifications) {
      context.shouldNotify = false;
    }
    context.db = options.connection;
  }

  if(context.db) {
    rdr.feed.subscribe.findFeed.call(context);
  } else {
    context.shouldCloseDB = true;
    rdr.openDB(rdr.feed.subscribe.onOpenDB.bind(context));
  }
};

rdr.feed.subscribe.onOpenDB = function(db) {
  if(db) {
    this.db = db;
    rdr.feed.subscribe.findFeed.call(this);
  } else {
    rdr.feed.subscribe.onComplete.call(this, {'type': 'ConnectionError'});
  }
};

// Before involving any network overhead, check if already subscribed.
// This uses a separate transaction from the eventual add request.
// This involves a race condition if calling subscribe concurrently on
// the same url, but its impact is limited. The latter http request will use
// the cached page, and the latter call will fail with a ConstraintError when
// trying to add the feed.
rdr.feed.subscribe.findFeed = function() {

  // TODO: i should be fully normalizing feed url

  const feedURLString = rdr.feed.getURL(this.feed);
  console.debug('Checking if subscribed to', feedURLString);
  const transaction = this.db.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(feedURLString);
  request.onsuccess = rdr.feed.subscribe.findFeedOnSuccess.bind(this);
  request.onerror = rdr.feed.subscribe.findFeedOnError.bind(this);
};

rdr.feed.subscribe.findFeedOnSuccess = function(event) {
  const feedURL = rdr.feed.getURL(this.feed);

  // Cannot resubscribe to an existing feed
  if(event.target.result) {
    console.debug('Already subscribed to', feedURL);
    rdr.feed.subscribe.onComplete.call(this, {'type': 'ConstraintError'});
    return;
  }

  // Subscribe while offline
  if('onLine' in navigator && !navigator.onLine) {
    rdr.feed.add(this.db, this.feed, rdr.feed.subscribe.onAddFeed.bind(this));
    return;
  }

  // Proceed with online subscription
  const shouldExcludeEntries = true;
  const feedURLObject = new URL(feedURL);
  rdr.feed.fetch(feedURLObject, shouldExcludeEntries,
    rdr.feed.subscribe.onFetchFeed.bind(this));
};

rdr.feed.subscribe.findFeedOnError = function(event) {
  rdr.feed.subscribe.onComplete.call(this, {'type': 'FindQueryError'});
};

rdr.feed.subscribe.onFetchFeed = function(event) {
  if(event.type !== 'success') {
    if(event.type === 'InvalidMimeType') {
      rdr.feed.subscribe.onComplete.call(this, {'type': 'FetchMimeTypeError'});
    } else {
      rdr.feed.subscribe.onComplete.call(this, {'type': 'FetchError'});
    }

    return;
  }

  this.feed = rdr.feed.merge(this.feed, event.feed);
  const urlString = this.feed.link ? this.feed.link :
    rdr.feed.getURL(this.feed);
  const urlObject = new URL(urlString);
  const doc = null;
  const verbose = false;
  rdr.favicon.lookup(urlObject, doc, verbose,
    rdr.feed.subscribe.onLookupFavicon.bind(this));
};

rdr.feed.subscribe.onLookupFavicon = function(iconURLObject) {
  if(iconURLObject) {
    this.feed.faviconURLString = iconURLObject.href;
  }

  rdr.feed.add(this.db, this.feed, rdr.feed.subscribe.onAddFeed.bind(this));
};

rdr.feed.subscribe.onAddFeed = function(event) {
  if(event.type === 'success') {
    this.didSubscribe = true;
    rdr.feed.subscribe.onComplete.call(this,
      {'type': 'success', 'feed': event.feed});
  } else {
    rdr.feed.subscribe.onComplete.call(this, {'type': event.type});
  }
};

rdr.feed.subscribe.onComplete = function(event) {
  if(this.shouldCloseDB && this.db) {
    this.db.close();
  }

  if(this.shouldNotify && this.didSubscribe) {
    // Use the sanitized feed object in place of the input object
    const feed = event.feed;
    const displayString = feed.title ||  rdr.feed.getURL(feed);
    const message = 'Subscribed to ' + displayString;
    rdr.notifications.show('Subscription complete', message,
      feed.faviconURLString);
  }

  if(this.callback) {
    this.callback(event);
  }
};
