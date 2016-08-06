// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const subscribe = {};

// Subscribes to the given feed.
// Connection is optional. If not provided, then a connection is created.
// Callback is optional. If a callback is provided, calls back with an event
subscribe.start = function(feed, connection, callback) {
  console.assert(feed, 'feed is required');

  // Create a shared context to simplify passing parameters to continuations
  const context = {
    'feed': feed,
    'didSubscribe': false,
    'callback': callback,
    'connection': connection
  };

  // Start by verifying the feed. At a minimum, the feed must have a url.
  if(!feed.hasURL()) {
    subscribe.onComplete(context, {'type': 'MissingURLError'});
    return;
  }

  console.debug('Subscribing to', feed.getURL().toString());

  if(connection) {
    subscribe.findFeed(context);
  } else {
    openIndexedDB(subscribe.onOpenDatabase.bind(null, context));
  }
};

subscribe.onOpenDatabase = function(context, connection) {
  if(connection) {
    context.connection = connection;
    subscribe.findFeed(context);
  } else {
    subscribe.onComplete(context, {'type': 'ConnectionError'});
  }
};

subscribe.findFeed = function(context) {
  console.debug('Checking if subscribed to feed with url',
    context.feed.getURL().toString());
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
  const transaction = context.connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(context.feed.getURL().toString());
  request.onsuccess = subscribe.findFeedOnSuccess.bind(null, context);
  request.onerror = subscribe.findFeedOnError.bind(null, context);
};

subscribe.findFeedOnSuccess = function(context, event) {

  // Callback with an error if already subscribed
  if(event.target.result) {
    console.debug('Already subscribed to',
      Feed.prototype.getURL.call(event.target.result));
    subscribe.onComplete(context, {'type': 'ConstraintError'});
    return;
  }

  // Otherwise, continue with the subscription
  if('onLine' in navigator && !navigator.onLine) {
    // Proceed with an offline subscription
    addFeed(context.connection, feed, subscribe.onAddFeed.bind(null, context));
  } else {
    // Online subscription. Verify the remote file is a feed that exists
    // and get its info
    const timeoutMillis = 10 * 1000;
    const excludeEntries = true;
    fetchFeed(context.feed.getURL(), timeoutMillis, excludeEntries,
      subscribe.onFetchFeed.bind(null, context));
  }
};

subscribe.findFeedOnError = function(context, event) {
  subscribe.onComplete(context, {'type': 'FindQueryError'});
};

subscribe.onFetchFeed = function(context, event) {
  if(event.type === 'load') {

    // TODO: this needs to merge the remote feed with the local feed's
    // properties, not just store the remote feed.

    // Add the feed to the database
    addFeed(context.connection, event.feed,
      subscribe.onAddFeed.bind(null, context));
  } else {
    // Go to exit
    subscribe.onComplete(context, {'type': 'FetchError'});
  }
};

subscribe.onAddFeed = function(context, event) {
  if(event.type === 'success') {
    // Flag the subscription as successful
    context.didSubscribe = true;
    subscribe.onComplete(context, {'type': 'success', 'feed': event.feed});
  } else {
    // The add can fail for various reasons, such as a database error,
    // or because of a constraint error (feed with same url already exists)
    subscribe.onComplete(context, {'type': event.type});
  }
};

subscribe.onComplete = function(context, event) {
  if(context.connection) {
    context.connection.close();
  }

  // Show a notification
  if(context.didSubscribe && 'SHOW_NOTIFICATIONS' in localStorage) {
    const message = 'Subscribed to ' + (event.feed.title ||
      Feed.prototype.getURL.call(event.feed).toString());
    const notification = {
      'type': 'basic',
      'title': chrome.runtime.getManifest().name,
      'iconUrl': '/images/rss_icon_trans.gif',
      'message': message
    };
    chrome.notifications.create('Lucubrate', notification, function() {});
  }

  // Callback if one was provided
  if(context.callback) {
    context.callback(event);
  }
};
