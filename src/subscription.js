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
        'type': 'error',
        'message': 'Fetch error'
      });
      return;
    }

    const storableFeed = createStorableFeed(event.feed);
    feedCache.addFeed(connection, storableFeed,
      onAddFeed.bind(null, storableFeed));
  }

  function createStorableFeed(inputFeed) {
    const storable = Object.create(null);
    storable.urls = inputFeed.urls.map(function(url) {
      return url.href;
    });

    storable.type = inputFeed.type;
    if(inputFeed.link) {
      storable.link = inputFeed.link.href;
    }

    storable.title = sanitizeString(inputFeed.title) || '';

    if(inputFeed.description) {
      storable.description = sanitizeString(inputFeed.description);
    }

    if(inputFeed.datePublished) {
      storable.datePublished = inputFeed.datePublished;
    }

    storable.dateLastModified = inputFeed.dateLastModified;
    storable.dateFetched = inputFeed.dateFetched;
    return storable;
  }

  function sanitizeString(inputString) {
    let outputString = inputString;
    if(inputString) {
      outputString = filterControlCharacters(outputString);
      outputString = replaceHTML(outputString, '');

      outputString = outputString.replace(/\s+/, ' ');
      outputString = outputString.trim();
    }
    return outputString;
  }

  function onAddFeed(addedFeed, event) {
    if(event.type !== 'success') {
      const errorEvent = Object.create(null);
      errorEvent.type = 'error';
      const error = event.target.error;
      if(error && error.name === 'ConstraintError') {
        errorEvent.message = 'You are already subscribed to this feed.';
      } else {
        errorEvent.message =
          'There was a problem adding the feed to the database.';
      }

      callback(errorEvent);
      return;
    }

    addedFeed.id = event.target.result;
    showSubscriptionNotification(addedFeed);

    const successEvent = Object.create(null);
    successEvent.type = 'success';
    successEvent.message = 'Successfully subscribed to ' +
      (addedFeed.title || 'Untitled');
    successEvent.feed = addedFeed;
    callback(successEvent);
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
