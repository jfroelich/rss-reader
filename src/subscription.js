// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
const Subscription = {};

// TODO: look into a more native way of creating event objects
// TODO: use a URL object?
// TODO: I could consider a flag passed to fetchFeed that then passes a
// flag to FeedParser that says to ignore entry information because we
// are only getting general feed information, this would be a very minor
// speedup but also it would be self-documenting the use case more clearly.
// TODO: not sure but I think this should be using responseURL somehow? I
// should be using responseURL instead of the input url in the event that it
// changed? Should fetchFeed be doing that instead of this?
// NOTE: this does not also add the entries of the feed
Subscription.add = function(connection, urlString, callback) {
  console.debug('Subscribing to', urlString);

  const fetchTimeoutMillis = 10 * 1000;
  fetchFeed(urlString, fetchTimeoutMillis, onFetchFeed);

  function onFetchFeed(fetchEvent, fetchedFeed, responseURL) {

    // Temp, testing
    if(responseURL !== urlString) {
      console.debug('url changed from %s to %s', urlString, responseURL);
    }

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
    Feed.put(connection, existingFeed, fetchedFeed, onPutFeed);
  }

  function onPutFeed(putEvent) {

    // TODO: disambiguate whether the error was a uniqueness constraint
    // violation or some other general error.

    if(putEvent.type !== 'success') {

      console.dir(putEvent);

      const event = {};
      event.type = 'error';
      event.message = 'There was a problem adding the feed to the database';
      callback(event);
      return;
    }

    if(localStorage.SHOW_NOTIFICATIONS) {
      // TODO: I'd like to improve the contents of the notification. I would
      // like to set title but right now I can only get newFeedId from
      // Feed.put, and I would like to use a better notification title
      // Maybe Feed.put should be passing along the put feed.
      const notification = {
        'type': 'basic',
        'title': chrome.runtime.getManifest().name,
        'iconUrl': '/images/rss_icon_trans.gif',
        'message': 'Subscribed to ' + urlString
      };
      chrome.notifications.create('Lucubrate', notification, function() {});
    }

    // We do not need to affect the unread count because we are not dealing
    // with entries, just the feed itself.

    // And finally, callback successfully

    // TODO: I think the options page needs more information than this
    // so that it can avoid another roundtrip back to the database to pull
    // the details of the new feed so it can immediately add it to the
    // displayed feeds list.
    // So again, I think Feed.put needs to pass back the inserted feed,
    // not just the putEvent

    const event = {};
    event.type = 'success';
    event.message = 'Successfully subscribed to ' + urlString;

    // TODO: look into the conventions of how non-standard event properties
    // are defined? Is it just whatever I want? Is it event.data = {...} ?
    const newFeedId = putEvent.target.result;

    event.newFeedId = newFeedId;
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
