// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param feed a basic object representing a feed
// @param options {Object} optional object containing optional callback
// and optional open connection
function subscribe(feed, options) {
  console.assert(feed);
  console.assert(feed.urls);
  console.assert(feed.urls.length);

  const feedURL = getFeedURL(feed);
  console.log('Subscribing to', feedURL);

  const context = {
    'feed': feed,
    'didSubscribe': false,
    'callback': options ? options.callback : null,
    'db': options ? options.connection : null,
    'shouldCloseDB': false,
    'shouldNotNotify': options ? options.suppressNotifications : false
  };

  if(context.db) {
    findFeed.call(context);
  } else {
    openDB(onOpenDB.bind(context));
  }
}

function onOpenDB(db) {
  if(db) {
    this.db = db;
    this.shouldCloseDB = true;
    findFeed.call(this);
  } else {
    onSubscribeComplete.call(this, {'type': 'ConnectionError'});
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
function findFeed() {

  // TODO: i should be fully normalizing feed url

  const feedURLString = getFeedURL(this.feed);
  console.debug('Checking if subscribed to', feedURLString);
  const transaction = this.db.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(feedURLString);
  request.onsuccess = findFeedOnSuccess.bind(this);
  request.onerror = findFeedOnError.bind(this);
}

function findFeedOnSuccess(event) {
  if(event.target.result) {
    const feedURL = getFeedURL(this.feed);
    console.debug('Already subscribed to', feedURL);
    onSubscribeComplete.call(this, {'type': 'ConstraintError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    addFeed.call(this, this.feed, onAddFeed.bind(this));
  } else {
    const shouldExcludeEntries = true;
    const feedURL = getFeedURL(this.feed);
    const feedURLObject = new URL(feedURL);
    fetchFeed(feedURLObject, shouldExcludeEntries, onFetchFeed.bind(this));
  }
}

function findFeedOnError(event) {
  onSubscribeComplete.call(this, {'type': 'FindQueryError'});
}

function onFetchFeed(event) {
  if(event.type !== 'success') {
    if(event.type === 'invalid_mime_type') {
      onSubscribeComplete.call(this, {'type': 'FetchMimeTypeError'});
    } else {
      onSubscribeComplete.call(this, {'type': 'FetchError'});
    }

    return;
  }

  // TODO: instead of adding the feed, this is where I should be looking for
  // the feed's favicon. We know we are probably online at this point and are
  // not subscribing while offline, and we know that the feed xml file exists.
  // Or, instead of this, fetchFeed should be doing it

  const feed = mergeFeeds(this.feed, event.feed);

  // Ensure that the date last modified is not set, so that the next poll will
  // not ignore the file's entries.
  // TODO: maybe it would be better to modify poll's last modified check to
  // also check if feed was ever polled (e.g. has dateUpdated field set)
  delete feed.dateLastModified;

  addFeed.call(this, feed, onAddFeed.bind(this));
}

function onAddFeed(event) {
  if(event.type === 'success') {
    this.didSubscribe = true;
    onSubscribeComplete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    onSubscribeComplete.call(this, {'type': event.type});
  }
}

function onSubscribeComplete(event) {
  if(this.shouldCloseDB && this.db) {
    this.db.close();
  }

  if(!this.shouldNotNotify && this.didSubscribe) {
    // TODO: if addFeed calls back with a Feed object, then I wouldn't need
    // to use call here. This also means this passes back a Feed object instead
    // of a basic object, which means I would need to update all callers
    // TODO: the notification should probably use the feed's favicon if
    // available, and only then fall back
    const displayString = event.feed.title ||  getFeedURL(event.feed);
    const message = 'Subscribed to ' + displayString;
    showDesktopNotification('Subscription complete', message);
  }

  if(this.callback) {
    this.callback(event);
  }
}

this.subscribe = subscribe;

} // End file block scope
