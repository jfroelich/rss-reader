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

  const feed_url = get_feed_url(feed);
  console.log('Subscribing to', feed_url);

  const context = {
    'feed': feed,
    'did_subscribe': false,
    'callback': options ? options.callback : null,
    'db': options ? options.connection : null,
    'should_close': false,
    'no_notify': options ? options.suppressNotifications : false
  };

  if(context.db) {
    find_feed.call(context);
  } else {
    open_db(on_open_db.bind(context));
  }
}

function on_open_db(db) {
  if(db) {
    this.db = db;
    this.should_close = true;
    find_feed.call(this);
  } else {
    on_complete.call(this, {'type': 'ConnectionError'});
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
function find_feed() {
  const url_string = get_feed_url(this.feed);
  console.debug('Checking if subscribed to', url_string);
  const transaction = this.db.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(url_string);
  request.onsuccess = find_feed_onsuccess.bind(this);
  request.onerror = find_feed_onerror.bind(this);
}

function find_feed_onsuccess(event) {
  if(event.target.result) {
    const feed_url = get_feed_url(this.feed);
    console.debug('Already subscribed to', feed_url);
    on_complete.call(this, {'type': 'ConstraintError'});
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    add_feed.call(this, this.feed, on_add_feed.bind(this));
  } else {
    const exclude_entries = true;
    const feed_url = get_feed_url(this.feed);
    const feed_url_obj = new URL(feed_url);
    fetch_feed(feed_url_obj, exclude_entries, on_fetch_feed.bind(this));
  }
}

function find_feed_onerror(event) {
  on_complete.call(this, {'type': 'FindQueryError'});
}

function on_fetch_feed(event) {
  if(event.type !== 'success') {
    if(event.type === 'invalid_mime_type') {
      on_complete.call(this, {'type': 'FetchMimeTypeError'});
    } else {
      on_complete.call(this, {'type': 'FetchError'});
    }

    return;
  }

  // TODO: instead of adding the feed, this is where I should be looking for
  // the feed's favicon. We know we are probably online at this point and are
  // not subscribing while offline, and we know that the feed xml file exists.
  // Or, instead of this, fetch_feed should be doing it

  const feed = merge_feeds(this.feed, event.feed);

  // Ensure that the date last modified is not set, so that the next poll will
  // not ignore the file's entries.
  // TODO: maybe it would be better to modify poll's last modified check to
  // also check if feed was ever polled (e.g. has dateUpdated field set)
  delete feed.dateLastModified;

  add_feed.call(this, feed, on_add_feed.bind(this));
}

function on_add_feed(event) {
  if(event.type === 'success') {
    this.did_subscribe = true;
    on_complete.call(this, {'type': 'success', 'feed': event.feed});
  } else {
    on_complete.call(this, {'type': event.type});
  }
}

function on_complete(event) {
  if(this.should_close && this.db) {
    this.db.close();
  }

  if(!this.no_notify && this.did_subscribe) {
    // TODO: if addFeed calls back with a Feed object, then I wouldn't need
    // to use call here. This also means this passes back a Feed object instead
    // of a basic object, which means I would need to update all callers
    // TODO: the notification should probably use the feed's favicon if
    // available, and only then fall back
    const display_string = event.feed.title ||  get_feed_url(event.feed);
    show_desktop_notification('Subscription complete', 'Subscribed to ' + display_string);
  }

  if(this.callback) {
    this.callback(event);
  }
}

this.subscribe = subscribe;

} // End file block scope
