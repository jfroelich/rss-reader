// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
const Subscription = {};

// TODO: look into a more native way of creating event objects
// TODO: use a URL object instead of a URL string where appropriate?
// TODO: I could consider a flag passed to fetchFeed that then passes a
// flag to FeedParser that says to ignore entry information because we
// are only getting general feed information, this would be a very minor
// speedup but also it would be self-documenting the use case more clearly.
// TODO: not sure but I think this should be using responseURL somehow? I
// should be using responseURL instead of the input url in the event that it
// changed? Should fetchFeed be doing that instead of this?
// TODO: shouldn't the feed's url be normalized so that comparison works
// properly?

// NOTE: this does not also add the entries of the feed, because that would
// take too long
// NOTE: you must be online in order to subscribe
Subscription.add = function(connection, urlString, callback) {
  console.debug('Subscribing to', urlString);

  // TODO: I think fetchFeed should always defined its event, and it should
  // pass back a single custom event object with various properties. I should
  // not be simply testing for whether the event is defined, but instead
  // testing against the event's type property.
  const fetchTimeoutMillis = 10 * 1000;
  fetchFeed(urlString, fetchTimeoutMillis, onFetchFeed);

  function onFetchFeed(fetchEvent, fetchedFeed, responseURL) {

    // Temp, testing
    if(responseURL !== urlString) {
      console.debug('url changed from %s to %s', urlString, responseURL);
    }

    // fetchEvent is currently only defined if an error occurred when
    // fetching
    if(fetchEvent) {
      const event = {};
      event.type = 'error';

      // TODO: not sure I want to just pass back the actual message. I should
      // look into passing back nicer messages because this is displayed
      // directly to the user.

      // TODO: check that fetchEvent.message is what I want
      // This log message is temporary for debugging
      console.dir(fetchEvent);

      event.message = fetchEvent.message;
      callback(event);
      return;
    }

    const existingFeed = null;
    putFeed(connection, existingFeed, fetchedFeed, onPutFeed);
  }

  function onPutFeed(storedFeed, putEvent) {
    if(putEvent.type !== 'success') {
      const event = {};
      event.type = 'error';

      const error = putEvent.target.error;
      if(error && error.name === 'ConstraintError') {
        event.message = 'You are already subscribed to this feed';
      } else {
        event.message = 'There was a problem adding the feed to the database';
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

    const event = {};
    event.type = 'success';
    event.message = 'Successfully subscribed to ' +
      (storedFeed.title || 'Untitled');
    event.newFeedTitle = storedFeed.title || 'Untitled';
    event.newFeedId = storedFeed.id;
    callback(event);
  }
};

Subscription.remove = function(feedId, callback) {
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

  db.open(onOpenDatabase);

  function onOpenDatabase(event) {
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
