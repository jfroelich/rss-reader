// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Subscription-related functions
// Requires: /src/badge.js
// Requires: /src/db.js

const SubscriptionManager = {};

// TODO: move functionality out of options and into here
// TODO: opml-import should also use this to import feeds
SubscriptionManager.subscribe = function() {
  throw new Error('Not yet implemented');
};

// Unsubscribes from a feed. Removes any entries corresponding to the feed,
// removes the feed, and then calls the callback.
// @param feedId - integer
SubscriptionManager.unsubscribe = function(feedId, callback) {

  let entriesRemoved = 0;

  // Although I generally do not guard against invalid inputs, I do so here
  // because this could pretend to be successful otherwise.
  if(!feedId || isNaN(feedId)) {
    const subscriptionEvent = {
      'type': 'error',
      'subtype': 'invalid_id',
      'feedId': feedId,
      'entriesRemoved': entriesRemoved
    };
    callback(subscriptionEvent);
    return;
  }

  db.open(onConnect);

  function onConnect(event) {
    if(event.type !== 'success') {
      // TODO: expose some more info about a connection error? What are the
      // props to consider from the indexedDB event?
      const subscriptionEvent = {
        'type': 'error',
        'subtype': 'connection_error',
        'feedId': feedId,
        'entriesRemoved': entriesRemoved
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

    const connectionRequest = event.target;
    const connection = connectionRequest.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onRemoveEntries;
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(id);
    request.onsuccess = deleteNextEntry;
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
    }
  }

  function removeFeed(event) {

    // TODO: double check this is how to get the connection variable from
    // the event

    const connection = event.target.db;
    const transaction = connection.transaction('feed', 'readwrite');
    const store = transaction.objectStore('feed');
    const request = store.delete(feedId);
    request.onsuccess = onComplete;
  }

  function onComplete(event) {
    const connection = event.target.db;

    // NOTE: This happens after because it is a separate read transaction,
    // despite pending delete requests of the previous transaction
    utils.updateBadgeText(connection);

    const subscriptionEvent = {
      'type': 'success',
      'feedId': feedId,
      'entriesRemoved': entriesRemoved
    };
    callback(subscriptionEvent);
  }
};
