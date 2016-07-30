// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Subscription = {};

Subscription.add = function(url, callback) {
  console.debug('Subscribing to', url.href);
  const context = {};
  context.url = url;
  context.callback = callback;
  context.cache = new FeedCache();
  context.cache.open(Subscription.addOnOpenDatabase.bind(null, context));
};

Subscription.addOnOpenDatabase = function(context, connection) {
  if(connection) {
    if('onLine' in navigator && !navigator.onLine) {
      const feed = {};
      Feed.prototype.addURL.call(feed, url.href);
      context.cache.addFeed(connection, feed,
        Subscription.onAddFeed.bind(null, context));
    } else {
      context.connection = connection;
      const fetchService = new FeedHttpService();
      fetchService.timeoutMillis = 10 * 1000;
      const excludeEntries = true;
      fetchService.fetch(context.url, excludeEntries,
        Subscription.onFetchFeed.bind(null, context));
    }
  } else {
    context.callback({'type': 'ConnectionError'});
  }
};

Subscription.onFetchFeed = function(context, event) {
  if(event.type === 'load') {
    context.cache.addFeed(context.connection, event.feed,
      Subscription.onAddFeed.bind(null, context));
  } else {
    context.callback({'type': 'FetchError'});
  }
};

Subscription.onAddFeed = function(context, event) {
  if(event.type === 'success') {
    Subscription.showSubscriptionNotification(event.feed);
    context.callback({'type': 'success', 'feed': event.feed});
  } else {
    context.callback({'type': event.type});
  }
};

Subscription.showSubscriptionNotification = function(feed) {
  if('SHOW_NOTIFICATIONS' in localStorage) {
    const notification = {
      'type': 'basic',
      'title': chrome.runtime.getManifest().name,
      'iconUrl': '/images/rss_icon_trans.gif',
      'message': 'Subscribed to ' + (feed.title || 'Untitled')
    };
    chrome.notifications.create('Lucubrate', notification, function() {});
  }
};

Subscription.remove = function(feedId, callback) {
  console.assert(feedId && !isNaN(feedId), 'invalid feed id %s', feedId);

  const badgeUpdateService = new BadgeUpdateService();
  const feedCache = new FeedCache();
  let entriesRemoved = 0;
  feedCache.open(onOpenDatabase);

  function onOpenDatabase(connection) {
    if(connection) {
      feedCache.openEntryCursorForFeed(connection, feedId, deleteNextEntry);
    } else {
      callback({
        'type': 'connection-error',
        'feedId': feedId,
        'entriesRemoved': 0
      });
    }
  }

  function deleteNextEntry(event) {
    const request = event.target;
    const cursor = request.result;
    if(cursor) {
      const entry = cursor.value;
      cursor.delete();
      entriesRemoved++;
      sendEntryDeleteRequestedMessage(entry);
      cursor.continue();
    } else {
      onRemoveEntries(event);
    }
  }

  function sendEntryDeleteRequestedMessage(entry) {
    const message = {
      'type': 'entryDeleteRequestedByUnsubscribe',
      'entryId': entry.id
    };
    chrome.runtime.sendMessage(message);
  }

  function onRemoveEntries(event) {
    const connection = event.target.db;
    feedCache.deleteFeedById(connection, feedId, onComplete);
  }

  function onComplete(event) {
    badgeUpdateService.updateCount();
    callback({
      'type': 'success',
      'feedId': feedId,
      'entriesRemoved': entriesRemoved
    });
  }
};
