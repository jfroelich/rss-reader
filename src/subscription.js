// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Subscription = Object.create(null);

Subscription.add = function(connection, url, callback) {
  console.debug('Subscribing to', url.href);
  const fetchTimeoutMillis = 10 * 1000;
  const excludeEntries = true;
  fetchFeed(url, fetchTimeoutMillis, excludeEntries, onFetchFeed);

  function onFetchFeed(event) {
    if(event.type !== 'load') {
      const errorEvent = Object.create(null);
      errorEvent.type = 'error';
      errorEvent.message = 'There was a problem retrieving the feed';
      callback(errorEvent);
      return;
    }

    const storableFeed = createStorableFeed(fetchEvent.feed);
    db.addFeed(connection, storableFeed, onAddFeed.bind(null, storableFeed));
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
    storable.description = sanitizeString(inputFeed.description);
    storable.date = inputFeed.date;
    storable.dateLastModified = inputFeed.dateLastModified;
    storable.dateFetched = inputFeed.dateFetched;
    return storable;
  }

  // Prep a string property of an object for storage
  function sanitizeString(inputString) {
    let outputString = inputString;
    if(inputString) {
      outputString = filterControlCharacters(outputString);
      outputString = replaceHTML(outputString, '');
      // Condense whitespace
      // TODO: maybe this should be a utils function
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

    // Define the id
    addedFeed.id = event.target.result;

    if(localStorage.SHOW_NOTIFICATIONS) {
      const notification = {
        'type': 'basic',
        'title': chrome.runtime.getManifest().name,
        'iconUrl': '/images/rss_icon_trans.gif',
        'message': 'Subscribed to ' + (addedFeed.title || 'Untitled')
      };
      chrome.notifications.create('Lucubrate', notification,
        notificationCallback);
    }

    const successEvent = Object.create(null);
    successEvent.type = 'success';
    successEvent.message = 'Successfully subscribed to ' +
      (addedFeed.title || 'Untitled');
    // TODO: rather than pass back the whole feed, maybe only pass back
    // the relevant properties. The idea is to expose as little as possible?
    successEvent.feed = addedFeed;
    callback(successEvent);
  }

  // chrome.notifications.create requires some type of callback function
  function notificationCallback() {
    // NOOP
  }
};

Subscription.remove = function(feedId, callback) {
  let entriesRemoved = 0;

  // Although I generally do not guard against invalid inputs, I do so here
  // because this could pretend to be successful otherwise.
  if(!feedId || isNaN(feedId)) {
    const subscriptionEvent = {
      'type': 'invalid_feed_id_error',
      'feedId': feedId,
      'entriesRemoved': 0
    };
    callback(subscriptionEvent);
    return;
  }

  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
    if(event.type !== 'success') {
      // TODO: expose some more info about a connection error? What are the
      // props to consider from the indexedDB event?
      const subscriptionEvent = {
        'type': 'database_connection_error',
        'feedId': feedId,
        'entriesRemoved': 0
      };

      callback(subscriptionEvent);
      return;
    }

    // TODO: use a single transaction for both removing entries and for
    // removing the feed? Maybe I should be opening the transaction
    // here on both stores, and then passing around the transaction, not the
    // the connection. Note that if I do this, I cannot use
    // transaction.oncomplete
    // to forward. I have to forward only when cursor is undefined in the
    // iterating function. The question is, does it make sense to use a
    // single transaction or two transactions here? What is the point of a
    // transaction? Do I want this all to be able rollback? A similar strange
    // thing, is that if a rollback occurs, what does that mean to views that
    // already responded to early events sent in progress? In that case I can't
    // actually send out in progress events if I want to roll back properly.
    // The thing is, when would the transaction ever fail? Ever? And if it
    // could
    // even fail, do I want to be deleting the feed or its entries first when
    // using two separate transactions or does the order not matter?
    const connection = event.target.result;
    db.openEntryCursorForFeed(connection, feedId, deleteNextEntry);
  }

  function deleteNextEntry(event) {
    const request = event.target;
    const cursor = request.result;
    if(cursor) {
      const entry = cursor.value;
      // NOTE: async, do not wait
      cursor.delete();
      entriesRemoved++;
      const entryDeletedMessage = {
        'type': 'entryDeleteRequestedByUnsubscribe',
        'entryId': entry.id
      };
      // NOTE: Ignores possible transaction rollback
      chrome.runtime.sendMessage(entryDeletedMessage);
      cursor.continue();
    } else {
      onRemoveEntries(event);
    }
  }

  function onRemoveEntries(event) {
    // TODO: double check this is how to get the connection variable from
    // the event
    const connection = event.target.db;
    db.deleteFeedById(connection, feedId, onComplete);
  }

  function onComplete(event) {
    const connection = event.target.db;

    // NOTE: This happens after because it is a separate read transaction,
    // despite pending delete requests of the previous transaction
    updateBadgeUnreadCount(connection);

    const subscriptionEvent = {
      'type': 'success',
      'feedId': feedId,
      'entriesRemoved': entriesRemoved
    };
    callback(subscriptionEvent);
  }
};
