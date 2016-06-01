// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Subscription-related functions
// Requires: /src/badge.js
// Requires: /src/db.js

const SubscriptionManager = {};

// TODO: if the file name is subscription. then this should be using an
// object with the name Subscription, not SubscriptionManager
// TODO: look into a more native way of creating event objects
// TODO: use a URL object?
// TODO: I have mixed feelings about whether a fetch error means that this
// should cancel the subscription. Have not fully thought through it.
// Maybe I could require you to be online to subscribe, and then it would
// make more sense to deny subscribing if a problem occurred.

SubscriptionManager.subscribe = function(connection, urlString, shouldFetch,
  shouldShowNotification, callback) {
  console.debug('Subscribing to', urlString);

  // TODO: Maybe I don't need this guard. Calling filterProtocol will
  // fail if undefined and I can react to that.
  if(!urlString) {
    const event = {};
    event.type = 'error';
    event.message = 'Missing url';
    callback(event);
    return;
  }


  // TODO: Maybe I don't need this. Calling out to XMLHttpRequest and having
  // it fail does this for me.

  if(!utils.url.isURLString(urlString)) {
    const event = {};
    event.type = 'error';
    event.message = 'Invalid url: ' + urlString;
    callback(event);
    return;
  }

  // Now that we know we have a valid url, check if a similar feed already
  // exists in the database. Even though the eventual put request would fail
  // because a duplicate url would violate the uniqueness constraint, I do
  // this extra request because it possibly avoids the need to fetch, and
  // because if I do fetch I want the put to use the fetched info. Also,
  // because I don't quite know how I differentiate between various put request
  // errors (uniqueness constraint vs other general error).

  // TODO: maybe I don't need to do the exists check. Maybe it really is
  // redundant. So what if I do a wasted fetch. If the put fails because
  // the uniqueness constraint is violated (on the schemeless index) then
  // that is fine. It would greatly simplify this code after all.


  // TODO: rather than find by the exact urlString, this should probably
  // be somehow querying by a normalized url string. Right now this
  // unfortunately is case-sensitive, and whitespace sensitive, and all that
  // and I think this can potentially cause problems.
  // Where should url cleaning and normalization take place? Here or in the
  // calling context?
  // Right now I am just stripping protocol. That is probably not right.
  // I need to be normalizing instead of just stripping. I do however
  // want to normalize alternate protocols all into http, but just for
  // the purposes of comparision. So I shouldn't even be using a schemeless
  // index, I should be using a normalizedURLForComparisionPurposes kind of
  // index.
  // TODO: I was revising filterProtocol and noticed that it can possibly
  // throw an exception. I need to
  // clearly define the behavior regarding invalid urls. filterProtocol
  // currently can throw, and because this does not catch, it also can throw.
  // NOTE: at this point we know the url is valid, because it passed the
  // earlier test of isURLString, so we do not need to be concerned
  // However, maybe it makes sense to have filterProtocol accept a URL
  // object instead of a string as its parameter.

  const connection = connectionEvent.target.result;
  const transaction = connection.transaction('feed');
  const feedStore = transaction.objectStore('feed');
  const index = feedStore.index('schemeless');
  const schemeless = utils.url.filterProtocol(urlString);
  const request = index.get(schemeless);
  request.onsuccess = onFindByURL;

  function onFindByURL(findEvent) {
    const existingFeed = findEvent.target.result;
    if(existingFeed) {
      const event = {};
      event.type = 'error';
      event.message = 'A feed with the same url already exists';
      callback(event);
      return;
    }

    if(shouldFetch && navigator.onLine) {
      const fetchTimeoutMillis = 10 * 1000;
      fetchFeed(urlString, fetchTimeoutMillis, onFetchFeed);
    } else {
      const newFeed = {'url': urlString};
      Feed.put(connection, null, newFeed, onPutFeed);
    }
  }

  function onFetchFeed(fetchEvent, fetchedFeed, responseURL) {

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

    if(putEvent.type !== 'success') {
      const event = {};
      event.type = 'error';
      event.message = 'There was a problem adding the feed to the database';
      callback(event);
      return;
    }

    if(shouldShowNotification && localStorage.SHOW_NOTIFICATIONS) {
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
