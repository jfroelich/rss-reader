// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Subscribe to a new feed
function SubscribeTask() {
  this.openDBTask = new FeedDb();
  this.lookupTask = new LookupFaviconTask();
  this.log = new LoggingService();
  this.Feed = Feed;
  this.addFeed = addFeed;
  this.fetchFeedTask = new FetchFeedTask();
  this.showNotification = rdr.notifications.show;
}

// TODO: revert back to explicit params, stop using options param
// @param feed a basic object representing a feed
// @param options {Object} optional object containing optional callback
// and optional open connection
SubscribeTask.prototype.start = function(feed, options) {
  const feedURLString = this.Feed.getURL(feed);
  if(!feedURLString) {
    throw new TypeError('missing url');
  }

  this.log.log('Subscribing to', feedURLString);

  const ctx = {
    'feed': feed,
    'didSubscribe': false,
    'shouldCloseDB': false,
    'shouldNotify': true
  };

  if(options) {
    ctx.callback = options.callback;
    if(options.suppressNotifications) {
      ctx.shouldNotify = false;
    }
    ctx.db = options.connection;
  }

  if(ctx.db) {
    this._findFeed(ctx);
  } else {
    ctx.shouldCloseDB = true;
    this.openDBTask.open(this._openDBOnSuccess.bind(this, ctx),
      this._openDBOnError.bind(this, ctx));
  }
};

SubscribeTask.prototype._openDBOnSuccess = function(ctx, event) {
  this.log.log('Connected to database');
  ctx.db = event.target.result;
  this._findFeed(ctx);
};

SubscribeTask.prototype._openDBOnError = function(ctx, event) {
  this.log.error(event.target.error);
  this.onComplete(ctx, {'type': 'ConnectionError'});
};

// Before involving any network overhead, check if already subscribed.
// This uses a separate transaction from the eventual add request.
// This involves a race condition if calling subscribe concurrently on
// the same url, but its impact is limited. The latter http request will use
// the cached page, and the latter call will fail with a ConstraintError when
// trying to add the feed.
// TODO: i should be fully normalizing feed url
SubscribeTask.prototype._findFeed = function(ctx) {
  const feedURLString = this.Feed.getURL(ctx.feed);
  this.log.log('Checking if subscribed to', feedURLString);
  const tx = ctx.db.transaction('feed');
  const store = tx.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(feedURLString);
  request.onsuccess = this._findFeedOnSuccess.bind(this, ctx);
  request.onerror = this._findFeedOnError.bind(this, ctx);
};

SubscribeTask.prototype._findFeedOnSuccess = function(ctx, event) {
  const feedURL = this.Feed.getURL(this.feed);

  // Cannot resubscribe to an existing feed
  if(event.target.result) {
    console.debug('Already subscribed to', feedURL);
    this._onComplete(ctx, {'type': 'ConstraintError'});
    return;
  }

  // Subscribe while offline
  if('onLine' in navigator && !navigator.onLine) {
    this.addFeed(ctx.db, ctx.feed, false, this._onAddFeed.bind(this, ctx));
    return;
  }

  // Proceed with online subscription
  const shouldExcludeEntries = true;
  const feedURLObject = new URL(feedURL);
  this.fetchFeedTask.start(feedURLObject, shouldExcludeEntries,
    this._onFetchFeed.bind(this, ctx));
};

SubscribeTask.prototype._findFeedOnError = function(ctx, event) {
  this.log.error(event.target.error);
  this._onComplete(ctx, {'type': 'FindQueryError'});
};

SubscribeTask.prototype._onFetchFeed = function(ctx, event) {
  if(event.type !== 'success') {
    this.log.log('fetch error');
    if(event.type === 'InvalidMimeType') {
      this._onComplete(ctx, {'type': 'FetchMimeTypeError'});
    } else {
      this._onComplete(ctx, {'type': 'FetchError'});
    }
    return;
  }

  ctx.feed = this.Feed.merge(ctx.feed, event.feed);
  const urlString = ctx.feed.link ? ctx.feed.link : this.Feed.getURL(this.feed);
  const urlObject = new URL(urlString);
  const doc = null;
  this.lookupTask.start(urlObject, doc, this._onLookupIcon.bind(this, ctx));
};

SubscribeTask.prototype._onLookupIcon = function(ctx, iconURL) {
  if(iconURL) {
    ctx.feed.faviconURLString = iconURL.href;
  }

  this.addFeed(ctx.db, ctx.feed, false, this._onAddFeed.bind(this, ctx));
};

SubscribeTask.prototype._onAddFeed = function(ctx, event) {
  if(event.type === 'success') {
    this.log.log('stored new feed');
    ctx.didSubscribe = true;
    this._onComplete(ctx, {'type': 'success', 'feed': event.feed});
  } else {
    this._onComplete(ctx, {'type': event.type});
  }
};

SubscribeTask.prototype._onComplete = function(ctx, event) {
  if(ctx.shouldCloseDB && ctx.db) {
    this.log.log('requesting database to close');
    ctx.db.close();
  }

  if(ctx.shouldNotify && ctx.didSubscribe) {
    // Grab data from the sanitized feed instead of the input
    const feed = event.feed;
    const displayString = feed.title ||  this.Feed.getURL(feed);
    const message = 'Subscribed to ' + displayString;
    this.showNotification('Subscription complete', message,
      feed.faviconURLString);
  }

  if(ctx.callback) {
    ctx.callback(event);
  }
};
