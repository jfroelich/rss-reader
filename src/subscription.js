// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Subscription = {};

Subscription.add = function(connection, url, callback) {
  console.debug('Subscribing to', url.href);

  const feedCache = new FeedCache();
  const excludeEntries = true;
  const fetchService = new FeedHttpService();
  fetchService.timeoutMillis = 10 * 1000;
  fetchService.fetch(url, excludeEntries, onFetchFeed);

  function onFetchFeed(event) {
    if(event.type !== 'load') {
      callback({
        'type': 'fetcherror',
        'message': 'Fetch error'
      });
      return;
    }

    feedCache.addFeed(connection, event.feed, onAddFeed);
  }

  function onAddFeed(eventType, feed) {
    if(eventType === 'success') {
      showSubscriptionNotification(feed);
      callback({
        'type': 'success',
        'feed': feed
      });
    } else {
      callback({'type': eventType});
    }
  }

  function showSubscriptionNotification(feed) {
    if('SHOW_NOTIFICATIONS' in localStorage) {
      const notification = {
        'type': 'basic',
        'title': chrome.runtime.getManifest().name,
        'iconUrl': '/images/rss_icon_trans.gif',
        'message': 'Subscribed to ' + (feed.title || 'Untitled')
      };
      chrome.notifications.create('Lucubrate', notification,
        notificationCallback);
    }
  }

  function notificationCallback() {}
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
