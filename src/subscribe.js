// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Subscribes to a new feed with the given url. Calls back with an event.
function subscribe(url, callback) {
  console.assert(url, 'url is required');
  console.assert('href' in url, 'url should be a URL-like object');

  console.debug('Subscribing to', url.href);

  // Create a shared context to simplify parameters to continuations
  const context = {};
  context.url = url;
  context.didSubscribe = false;
  context.callback = callback;
  context.cache = new FeedCache();

  context.cache.open(subscribeOnOpenDatabase.bind(null, context));
}

// subscribe helper
function subscribeOnOpenDatabase(context, connection) {
  // Go to exit if failed to connect
  if(!connection) {
    subscribeOnComplete(context, {'type': 'ConnectionError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    // Proceed with an offline subscription
    const feed = {};
    Feed.prototype.addURL.call(feed, url.href);
    context.cache.addFeed(connection, feed,
      subscribeOnAddFeed.bind(null, context));
  } else {
    // Online subscription. Verify the remote file is a feed that exists
    // and get its info
    context.connection = connection;
    const fetchService = new FeedHttpService();
    fetchService.timeoutMillis = 10 * 1000;
    const excludeEntries = true;
    fetchService.fetch(context.url, excludeEntries,
      subscribeOnFetchFeed.bind(null, context));
  }
}

// subscribe helper
function subscribeOnFetchFeed(context, event) {
  if(event.type === 'load') {
    // Add the feed to the database
    context.cache.addFeed(context.connection, event.feed,
      subscribeOnAddFeed.bind(null, context));
  } else {
    // Go to exit
    subscribeOnComplete(context, {'type': 'FetchError'});
  }
}

// subscribe helper
function subscribeOnAddFeed(context, event) {
  if(event.type === 'success') {
    // Flag the subscription as successful
    context.didSubscribe = true;
    subscribeOnComplete(context, {'type': 'success', 'feed': event.feed});
  } else {
    subscribeOnComplete(context, {'type': event.type});
  }
}

// subscribe helper
function subscribeOnComplete(context, event) {
  if(context.connection) {
    context.connection.close();
  }

  // Show a notification
  if(context.didSubscribe && 'SHOW_NOTIFICATIONS' in localStorage) {
    const message = 'Subscribed to ' + (event.feed.title || 'Untitled');
    const notification = {
      'type': 'basic',
      'title': chrome.runtime.getManifest().name,
      'iconUrl': '/images/rss_icon_trans.gif',
      'message': message
    };
    chrome.notifications.create('Lucubrate', notification, function() {});
  }

  // The final callback, which may be undefined because it is optional
  if(context.callback) {
    context.callback(event);
  }
}
