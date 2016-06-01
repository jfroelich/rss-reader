// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Subscription-related functions
// Requires: /src/badge.js
// Requires: /src/db.js

const SubscriptionManager = {};

// TODO: opml-import should also use this to import feeds
// TODO: should this expect a connection object instead of creating one on
// its own? It seems silly to reconnect per-subscribe when calling from
// opml. So yeah it does need a connection object. Which means connecting
// should be the responsibility of the caller? Or the connection parameter
// should be optional? In OPML we will pass one in, but in subscribe we will
// not?
// TODO: also, is the opml lib doing the exists look ups? If it is then that
// is kind of silly, because this also does the exists lookup. So that would
// also need to be changed.
// TODO: look into a more native way of creating event objects
// TODO: use a URL object?
// TODO: I have mixed feelings about whether a fetch error means that this
// should cancel the subscription. Have not fully thought through it.

SubscriptionManager.subscribe = function(urlString, shouldFetch, callback) {

  // Assume callback is a defined function
  // Assume doNotFetch is a parameter. It should be a boolean but still works
  // otherwise because we only test if defined/truthy.

  console.debug('Subscribing to', urlString);

  // Ensure that url is defined
  if(!urlString) {
    const event = {};
    event.type = 'error';
    event.message = 'Missing url';
    callback(event);
    return;
  }

  // Assume the url is a string, do not guard against other types
  // Assume url is trimmed
  // Assume url is normalized

  // Ensure the url is a url
  if(!utils.url.isURLString(urlString)) {
    const event = {};
    event.type = 'error';
    event.message = 'Invalid url: ' + urlString;
    callback(event);
    return;
  }

  db.open(onOpenDatabase);

  function onOpenDatabase(connectionEvent) {

    // Verify that we connected
    if(connectionEvent.type !== 'success') {
      const event = {};
      event.type = 'error';
      event.message = 'Unable to connect to database';
      callback(event);
      return;
    }

    // TODO: rather than find by the exact urlString, this should probably
    // be somehow querying by a normalized url string. Right now this
    // unfortunately is case-sensitive, and whitespace sensitive, and all that
    // and I think this can potentially cause problems.
    // Where should url cleaning and normalization take place? Here, or in
    // findByURL, or in the calling context?
    // Right now I am just stripping protocol. That is probably not right.
    // I need to be normalizing instead of just stripping. I do however
    // want to normalize alternate protocols all into http, but just for
    // the purposes of comparision. So I shouldn't even be using a schemeless
    // index, I should be using a normalizedURLForComparisionPurposes kind of
    // index.

    // NOTE: The lookup has to occur because we want to possibly fetch.
    // Obviously the put request would fail if a feed with the same url
    // already existed because there is a uniqueness constraint on the
    // url field of the feed store because we have a url index. So I have
    // to make this extra roundtrip, even though the check is done
    // again by the db when trying to put the feed.

    const connection = connectionEvent.target.result;

    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const index = store.index('schemeless');

    // TODO: I was revising filterProtocol and noticed that it can possibly
    // throw an exception. This is the sole caller of that function. I need to
    // clearly define the behavior regarding invalid urls. filterProtocol
    // currently can throw, and because this does not catch, it also can throw.
    // So I also need to look at this function's callers.
    const schemeless = utils.url.filterProtocol(urlString);
    const request = index.get(schemeless);

    const boundOnFindByURL = onFindByURL.bind(null, connection);
    request.onsuccess = boundOnFindByURL;

  }

  function onFindByURL(connection, findEvent) {
    const existingFeed = findEvent.target.result;

    // If a feed with the same url already exists, callback with an error.
    if(existingFeed) {
      const event = {};
      event.type = 'error';
      event.message = 'A feed with the same url already exists';
      callback(event);
      return;
    }

    // Otherwise, the feed does not exist, so it is ok to continue.

    if(shouldFetch && navigator.onLine) {
      // Online subscribe
      const boundOnFetchFeed = onFetchFeed.bind(null, connection);
      const fetchTimeoutMillis = 10 * 1000;
      fetchFeed(urlString, fetchTimeoutMillis, boundOnFetchFeed);
    } else {
      // Offline subscribe
      const newFeed = {'url': urlString};
      Feed.put(connection, null, newFeed, onPutFeed);
    }
  }

  function onFetchFeed(connection, fetchEvent, fetchedFeed, responseURL) {

    // NOTE: even though we fetched entry information along with the feed,
    // this ignores that. Entries are only added by the polling mechanism.
    // Entries have to go through a lot of processing which would
    // make the subscription process slow. So I have chosen to ignore any
    // entry information and just focus on the feed information.
    // TODO: I could consider a flag passed to fetchFeed that then passes a
    // flag to FeedParser that says to ignore entry information because we
    // are only getting general feed information, this would be a very minor
    // speedup but also it would be self-documenting the use case more clearly.

    // Check if there was a problem fetching the feed. If there was, cancel
    // the subscription.
    // fetchFeed only defined fetchEvent if an error occurred
    if(fetchEvent) {
      const event = {};
      event.type = 'error';

      // TODO: check that fetchEvent.message is what I want
      // This log message is temporary for debugging
      console.dir(fetchEvent);

      event.message = fetchEvent.message;
      callback(event);
      return;
    }

    // We were able to successfully fetch the feed, now add it
    const existingFeed = null;
    Feed.put(connection, existingFeed, fetchedFeed, onPutFeed);
  }

  function onPutFeed(putEvent) {

    // Check that the put was successful
    if(putEvent.type !== 'success') {
      const event = {};
      event.type = 'error';
      event.message = 'There was a problem adding the feed to the database';
      callback(event);
      return;
    }

    const newFeedId = putEvent.target.result;

    // Show a notification
    // TODO: if I want this to be used by OPML, then maybe I need a
    // general parameter that suppresses the notification here
    // TODO: how do I get title? In case of offline subscribe it is unknown,
    // and in case of online subscribe it is known but could be empty or
    // not set and also i don't pass it along through Feed.put so I lose it
    // Maybe Feed.put needs to pass back the object that was put
    const title = urlString;
    utils.showNotification('Subscribed to ' + title);

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
    event.newFeedId = newFeedId;
    callback(event);
  }
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
