// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const SubscribeTask = {};

SubscribeTask.start = function(url, callback) {
  console.assert(url, 'url is required');
  console.debug('Subscribing to', url.href);
  const context = {};
  context.url = url;
  context.didSubscribe = false;
  context.callback = callback;
  context.cache = new FeedCache();
  context.cache.open(SubscribeTask.onOpenCache.bind(null, context));
};

SubscribeTask.onOpenCache = function(context, connection) {
  if(connection) {
    if('onLine' in navigator && !navigator.onLine) {
      const feed = {};
      Feed.prototype.addURL.call(feed, url.href);
      context.cache.addFeed(connection, feed,
        SubscribeTask.onAddFeed.bind(null, context));
    } else {
      context.connection = connection;
      const fetchService = new FeedHttpService();
      fetchService.timeoutMillis = 10 * 1000;
      const excludeEntries = true;
      fetchService.fetch(context.url, excludeEntries,
        SubscribeTask.onFetchFeed.bind(null, context));
    }
  } else {
    SubscribeTask.onComplete(context, {'type': 'ConnectionError'});
  }
};

SubscribeTask.onFetchFeed = function(context, event) {
  if(event.type === 'load') {
    context.cache.addFeed(context.connection, event.feed,
      SubscribeTask.onAddFeed.bind(null, context));
  } else {
    SubscribeTask.onComplete(context, {'type': 'FetchError'});
  }
};

SubscribeTask.onAddFeed = function(context, event) {
  if(event.type === 'success') {
    context.didSubscribe = true;
    SubscribeTask.onComplete(context, {'type': 'success', 'feed': event.feed});
  } else {
    SubscribeTask.onComplete(context, {'type': event.type});
  }
};

SubscribeTask.showNotification = function(feed) {
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

SubscribeTask.onComplete = function(context, event) {
  if(context.connection) {
    context.connection.close();
  }

  if(context.didSubscribe) {
    SubscribeTask.showNotification(event.feed);
  }

  if(context.callback) {
    context.callback(event);
  }
};


const UnubscribeTask = {};
UnubscribeTask.start = function(feedId, callback) {
  console.assert(feedId && !isNaN(feedId), 'invalid feed id %s', feedId);

  const context = {
    'feedId': feedId,
    'entriesRemoved': 0,
    'callback': callback,
    'cache': new FeedCache()
  };

  context.cache.open(UnsubscribeTask.onOpenDatabase.bind(null, context));
};

UnsubscribeTask.onOpenDatabase = function(context, connection) {
  if(connection) {
    context.connection = connection;
    context.cache.openEntryCursorForFeed(connection, context.feedId,
      UnsubscribeTask.deleteNextEntry.bind(null, context));
  } else {
    context.callback({
      'type': 'ConnectionError',
      'feedId': context.feedId,
      'entriesRemoved': context.entriesRemoved
    });
  }
};

UnsubscribeTask.deleteNextEntry = function(context, event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    cursor.delete();
    context.entriesRemoved++;
    UnsubscribeTask.sendEntryDeleteRequestedMessage(entry);
    cursor.continue();
  } else {
    UnsubscribeTask.onRemoveEntries(context);
  }
};

UnsubscribeTask.sendEntryDeleteRequestedMessage = function(entry) {
  chrome.runtime.sendMessage({
    'type': 'entryDeleteRequestedByUnsubscribe',
    'entryId': entry.id
  });
};

UnsubscribeTask.onRemoveEntries = function(context) {
  context.cache.deleteFeedById(context.connection, context.feedId,
    UnsubscribeTask.onDeleteFeed.bind(null, context));
};

UnsubscribeTask.onDeleteFeed = function(context, event) {
  if(context.entriesRemoved > 0) {
    const badgeUpdateService = new BadgeUpdateService();
    badgeUpdateService.updateCount();
  }

  context.callback({
    'type': 'success',
    'feedId': context.feedId,
    'entriesRemoved': context.entriesRemoved
  });
};
