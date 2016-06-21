// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Subscription = Object.create(null);

// TODO: look into a more native way of creating event objects
// TODO: i should search for both the http and https version of the url
// when checking if already subscribed. For example, if given an http url,
// this should search for the http url, then do a second search for the https
// url. I don't know how to do both in a single request. This will prevent
// people from being able to subscribe to both the secure and non-secure
// versions of the feed at the same time. I previously prevented this by not
// even storing the protocol, but now that I have switched to using
// normalized urls, and to do the multi-entry thing i want the full url.
// NOTE: I suppose I also have to do this in opml.js since I do not have a
// singe point of access for adding a feed. Perhaps I should change the opml
// import to use this, so that this becomes the single way a feed is added.
// NOTE: fetchFeed handled the case of modifying the feed's urls array
// in the event of a redirect, so there is no need to do it here.
// NOTE: url rewriting only applies to entry urls, not feed urls, so there
// is no need to rewrite the urls explicitly here
Subscription.add = function(connection, url, callback) {

  console.debug('Subscribing to', url.href);

  const fetchTimeoutMillis = 10 * 1000;
  const excludeEntries = true;
  fetchFeed(url, fetchTimeoutMillis, excludeEntries, onFetchFeed);

  function onFetchFeed(fetchEvent) {

    if(fetchEvent.type !== 'load') {
      const event = Object.create(null);
      event.type = 'error';
      event.message = 'There was a problem retrieving the feed';
      console.dir(fetchEvent);
      callback(event);
      return;
    }

    const existingFeed = null;
    db.putFeed(connection, existingFeed, fetchEvent.feed, onPutFeed);
  }

  function onPutFeed(storedFeed, putEvent) {
    if(putEvent.type !== 'success') {
      const event = Object.create(null);
      event.type = 'error';

      const error = putEvent.target.error;
      if(error && error.name === 'ConstraintError') {
        event.message = 'You are already subscribed to this feed.';
      } else {
        event.message = 'There was a problem adding the feed to the database.';
      }

      callback(event);
      return;
    }

    if(localStorage.SHOW_NOTIFICATIONS) {
      const notification = {
        'type': 'basic',
        'title': chrome.runtime.getManifest().name,
        'iconUrl': '/images/rss_icon_trans.gif',
        'message': 'Subscribed to ' + (storedFeed.title || 'Untitled')
      };
      chrome.notifications.create('Lucubrate', notification, function() {});
    }

    const event = Object.create(null);
    event.type = 'success';
    event.message = 'Successfully subscribed to ' +
      (storedFeed.title || 'Untitled');
    event.feed = storedFeed;
    callback(event);
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
    utils.updateBadgeUnreadCount(connection);

    const subscriptionEvent = {
      'type': 'success',
      'feedId': feedId,
      'entriesRemoved': entriesRemoved
    };
    callback(subscriptionEvent);
  }
};
