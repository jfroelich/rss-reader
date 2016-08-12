// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// The subscription module exports a subscription object with two functions,
// add and remove. subscription.add subscribes to a feed and
// subscription.remove unsubscribes from a feed.

(function(exports, Feed, openIndexedDB, fetchFeed, badge) {
'use strict';

// Subscribes to the given feed.
// @param feed {Feed} the feed to subscribe to, required
// @param options {Object} optional, optional callback, connection
function sub(feed, options) {
  console.assert(feed, 'feed is required');

  // Create a shared context to simplify passing parameters to continuations
  const context = {
    'feed': feed,
    'didSubscribe': false,
    'callback': options ? options.callback : null,
    'connection': options ? options.connection : null,
    'closeConnection': options && options.connection ? false : true,
    'suppressNotifications': options ? options.suppressNotifications : false
  };

  // Start by verifying the feed. At a minimum, the feed must have a url.
  if(!feed.hasURL()) {
    subOnComplete.call(context, {'type': 'MissingURLError'});
    return;
  }

  console.debug('Subscribing to', feed.getURL().toString());

  if(context.connection) {
    subFindFeed.call(context);
  } else {
    openIndexedDB(subOnOpenDatabase.bind(context));
  }
}

function subOnOpenDatabase(connection) {
  if(connection) {
    this.connection = connection;
    subFindFeed.call(this);
  } else {
    subOnComplete.call(this, {'type': 'ConnectionError'});
  }
}

// Before involving any network overhead, check if already subscribed. This
// check will implicitly happen again later when inserting the feed into the
// database, so it is partially redundant, but it can reduce the amount of
// processing in the common case.
// This uses a separate transaction from the eventual add request, because
// it is not recommended to have a long running transaction, and the amount of
// work that has to occur between this exists check and the add request takes
// a somewhat indefinite period of time, given network latency.
// This does involve a race condition if calling subscribe concurrently on
// the same url, but its impact is limited. The latter http request will use
// the cached page, and the latter call will fail with a ConstraintError when
// trying to add the feed.
function subFindFeed() {
  const urlString = this.feed.getURL().toString();
  console.debug('Checking if subscribed to', urlString);
  const transaction = this.connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(urlString);
  request.onsuccess = subFindFeedOnSuccess.bind(this);
  request.onerror = subFindFeedOnError.bind(this);
};

function subFindFeedOnSuccess(event) {

  // Callback with an error if already subscribed
  if(event.target.result) {
    console.debug('Already subscribed to', this.feed.getURL().toString());
    subOnComplete.call(this, {'type': 'ConstraintError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    // Proceed with an offline subscription
    subAddFeed.call(this, this.feed, subOnAddFeed.bind(this));
  } else {
    // Online subscription. Verify the remote file is a feed that exists
    // and get its info
    const timeoutMillis = 10 * 1000;
    const excludeEntries = true;
    fetchFeed(this.feed.getURL(), timeoutMillis, excludeEntries,
      subOnFetchFeed.bind(this));
  }
}

function subFindFeedOnError(event) {
  subOnComplete.call(this, {'type': 'FindQueryError'});
}

function subOnFetchFeed(event) {

  if(event.type !== 'load') {
    subOnComplete.call(this, {'type': 'FetchError'});
    return;
  }

  // TODO: instead of adding the feed, this is where I should be looking for
  // the feed's favicon. We know we are probably online at this point and are
  // not subscribing while offline, and we know that the feed xml file exists.


  const feed = this.feed.merge(event.feed);
  subAddFeed.call(this, feed, subOnAddFeed.bind(this));
}

function subAddFeed(feed, callback) {
  console.debug('Adding feed', feed);
  console.assert(!feed.id, 'feed.id is defined', feed.id);
  const sanitizedFeed = feed.sanitize();
  sanitizedFeed.dateCreated = new Date();

  const serializedFeed = sanitizedFeed.serialize();

  // Manually remove date last modified. Because we are subscribing without
  // handling entries, we want to prevent the poll from considering the file
  // unmodified the next time it runs, to ensure that it downloads entries.
  // TODO: maybe it would be better to modify poll's last modified check to
  // also check if feed was ever polled (e.g. has dateUpdated field set)
  delete serializedFeed.dateLastModified;


  const transaction = this.connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(serializedFeed);
  if(callback) {
    request.onsuccess = addOnSuccess;
    request.onerror = addOnError;
  }

  function addOnSuccess(event) {
    // Set the id generated by indexedDB
    serializedFeed.id = event.target.result;
    callback({'type': 'success', 'feed': serializedFeed});
  }

  function addOnError(event) {
    console.error(event);
    callback({'type': event.target.error.name});
  }
}

function subOnAddFeed(event) {
  if(event.type === 'success') {
    this.didSubscribe = true;
    subOnComplete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    subOnComplete.call(this, {'type': event.type});
  }
}

function subOnComplete(event) {
  if(this.closeConnection && this.connection) {
    this.connection.close();
  }

  if(!this.suppressNotifications && this.didSubscribe) {

    // TODO: if addFeed calls back with a Feed object, then I wouldn't need
    // to use call here. This also means this passes back a Feed object instead
    // of a basic object, which means I would need to update all callers

    // TODO: the notification should probably use the feed's favicon if
    // available, and only then fall back

    notify('Subscription complete', 'Subscribed to ' + (event.feed.title ||
      Feed.prototype.getURL.call(event.feed).toString()));
  }

  if(this.callback) {
    this.callback(event);
  }
}

function unsub(feedId, callback) {
  console.assert(feedId && !isNaN(feedId), 'invalid feed id', feedId);
  console.debug('Unsubscribing from feed with id', feedId);

  // Create a shared state for simple parameter passing to continuations
  const context = {
    'connection': null,
    'feedId': feedId,
    'deleteRequestCount': 0,
    'callback': callback
  };

  openIndexedDB(unsubOnOpenDatabase.bind(context));
}

function unsubOnOpenDatabase(connection) {
  if(connection) {
    this.connection = connection;
    // Open a cursor over the entries for the feed
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(this.feedId);
    request.onsuccess = unSubOnOpenCursor.bind(this);
    request.onerror = unSubOnOpenCursor.bind(this);
  } else {
    unsubOnComplete.call(this, 'ConnectionError');
  }
}

function unSubOnOpenCursor(event) {
  if(event.type === 'error') {
    console.error(event);
    unsubOnComplete.call(this, 'DeleteEntryError');
    return;
  }

  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    // Delete the entry at the cursor (async)
    cursor.delete();
    // Track the number of delete requests
    this.deleteRequestCount++;

    // Async, notify interested 3rd parties the entry will be deleted
    chrome.runtime.sendMessage({
      'type': 'entryDeleteRequested',
      'entryId': entry.id
    });
    cursor.continue();
  } else {
    unsubOnRemoveEntries.call(this);
  }
}

function unsubOnRemoveEntries() {
  console.debug('Deleting feed with id', this.feedId);
  const transaction = this.connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(this.feedId);
  request.onsuccess = unsubDeleteFeedOnSuccess.bind(this);
  request.onerror = unsubDeleteFeedOnError.bind(this);
}

function unsubDeleteFeedOnSuccess(event) {
  unsubOnComplete.call(this, 'success');
}

function unsubDeleteFeedOnError(event) {
  console.warn(event.target.error);
  unsubOnComplete.call(this, 'DeleteFeedError');
}

function unsubOnComplete(eventType) {

  if(this.connection) {
    if(this.deleteRequestCount) {
      console.debug('Requested %i entries to be deleted',
        this.deleteRequestCount);
      // Even though the deletes are async, the readonly transaction in
      // badge.update waits for the pending deletes to complete
      badge.update(this.connection);
    }

    this.connection.close();
  }

  if(this.callback) {
    this.callback({
      'type': eventType,
      'feedId': this.feedId,
      'deleteRequestCount': this.deleteRequestCount
    });
  }
}

exports.subscription = {};
exports.subscription.add = sub;
exports.subscription.remove = unsub;

}(this, Feed, openIndexedDB, fetchFeed, badge));
