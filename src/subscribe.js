// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const subscribe = {};

// Subscribes to the given feed.
// @param feed {Feed} the feed to subscribe to, required
// @param options {Object} optional, optional callback, connection
subscribe.start = function(feed, options) {
  console.assert(feed, 'feed is required');

  // Create a shared context to simplify passing parameters to continuations
  const context = {
    'feed': feed,
    'didSubscribe': false,
    'callback': options ? options.callback : null,
    'connection': options ? options.connection : null,
    'suppressNotifications': options ? options.suppressNotifications : false
  };

  // Start by verifying the feed. At a minimum, the feed must have a url.
  if(!feed.hasURL()) {
    subscribe.onComplete.call(context, {'type': 'MissingURLError'});
    return;
  }

  console.debug('Subscribing to', feed.getURL().toString());

  if(context.connection) {
    subscribe.findFeed.call(context);
  } else {
    openIndexedDB(subscribe.onOpenDatabase.bind(context));
  }
};

subscribe.onOpenDatabase = function(connection) {
  if(connection) {
    this.connection = connection;
    subscribe.findFeed.call(this);
  } else {
    subscribe.onComplete.call(this, {'type': 'ConnectionError'});
  }
};

subscribe.findFeed = function() {
  console.debug('Checking if subscribed to feed with url',
    this.feed.getURL().toString());
  // Before involving any network overhead, check if already subscribed. This
  // check will implicitly happen again later when inserting the feed into the
  // database, so it is partially redundant, but it can reduce the amount of
  // processing in the common case.
  // This uses a separate transaction from the eventual add request, because
  // it is not recommended to have a long running transaction, and the amount of
  // work that has to occur between this exists check and the add request takes
  // a somewhat indefinite period of time, given network latency.
  // This does involve a race condition if calling subscribe concurrently on
  // the same url, but its impact is limited. The latter http request will use
  // the cached page, and the latter call will fail with a ConstraintError when
  // trying to add the feed.
  const transaction = this.connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(this.feed.getURL().toString());
  request.onsuccess = subscribe.findFeedOnSuccess.bind(this);
  request.onerror = subscribe.findFeedOnError.bind(this);
};

subscribe.findFeedOnSuccess = function(event) {

  // Callback with an error if already subscribed
  if(event.target.result) {
    console.debug('Already subscribed to',
      Feed.prototype.getURL.call(event.target.result));
    subscribe.onComplete.call(this, {'type': 'ConstraintError'});
    return;
  }

  // Otherwise, continue with the subscription
  if('onLine' in navigator && !navigator.onLine) {
    // Proceed with an offline subscription
    addFeed(this.connection, feed, subscribe.onAddFeed.bind(this));
  } else {
    // Online subscription. Verify the remote file is a feed that exists
    // and get its info
    const timeoutMillis = 10 * 1000;
    const excludeEntries = true;
    fetchFeed(this.feed.getURL(), timeoutMillis, excludeEntries,
      subscribe.onFetchFeed.bind(this));
  }
};

subscribe.findFeedOnError = function(event) {
  subscribe.onComplete.call(this, {'type': 'FindQueryError'});
};

subscribe.onFetchFeed = function(event) {
  if(event.type === 'load') {

    // TODO: this needs to merge the remote feed with the local feed's
    // properties, not just store the remote feed.

    // Add the feed to the database
    addFeed(this.connection, event.feed,
      subscribe.onAddFeed.bind(this));
  } else {
    // Go to exit
    subscribe.onComplete.call(this, {'type': 'FetchError'});
  }
};

subscribe.onAddFeed = function(event) {
  if(event.type === 'success') {
    // Flag the subscription as successful
    this.didSubscribe = true;
    subscribe.onComplete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    // The add can fail for various reasons, such as a database error,
    // or because of a constraint error (feed with same url already exists)
    subscribe.onComplete.call(this, {'type': event.type});
  }
};

subscribe.onComplete = function(event) {
  if(this.connection) {
    this.connection.close();
  }

  if(!this.suppressNotifications && this.didSubscribe) {
    notify('Subscription complete', 'Subscribed to ' + (event.feed.title ||
      Feed.prototype.getURL.call(event.feed).toString()));
  }

  if(this.callback) {
    this.callback(event);
  }
};
