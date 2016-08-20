// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param forceResetLock {boolean} if true then polling continues even when
// locked
this.poll_feeds = function(forceResetLock) {
  console.log('Checking for new articles...');

  const context = {'pendingFeedsCount': 0, 'connection': null};

  if(forceResetLock) {
    release_lock();
  }

  if(is_locked()) {
    console.warn('Already running');
    on_complete.call(context);
    return;
  }

  acquire_lock();

  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Offline');
    on_complete.call(context);
    return;
  }

  // There currently is no way to set this flag in the UI, and
  // navigator.connection is still experimental.
  if('NO_POLL_METERED' in localStorage && navigator.connection &&
    navigator.connection.metered) {
    console.debug('Metered connection');
    on_complete.call(context);
    return;
  }

  // Check if idle and possibly cancel the poll or continue with polling
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idlePeriodInSeconds = 30;
    chrome.idle.queryState(idlePeriodInSeconds,
      on_query_idle.bind(context));
  } else {
    open_db(on_open_db.bind(context));
  }
};

function on_query_idle(state) {
  if(state === 'locked' || state === 'idle') {
    open_db(on_open_db.bind(this));
  } else {
    console.debug('Idle state', state);
    on_complete.call(this);
  }
}

function on_open_db(connection) {
  if(connection) {
    this.connection = connection;
    const transaction = connection.transaction('feed');
    const store = transaction.objectStore('feed');
    const request = store.openCursor();
    const onOpenFeedCursor = on_open_feeds_cursor.bind(this);
    request.onsuccess = onOpenFeedCursor;
    request.onerror = onOpenFeedCursor;
  } else {
    on_complete.call(this);
  }
}

function on_open_feeds_cursor(event) {
  if(event.type !== 'success') {
    on_complete.call(this);
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    on_complete.call(this);
    return;
  }

  this.pendingFeedsCount++;

  const feed = deserialize_feed(cursor.value);
  const excludeEntries = false;
  const timeout_ms = 0; //10 * 1000;
  fetch_feed(feed.get_url(), timeout_ms, excludeEntries,
    on_fetch_feed.bind(this, feed));

  cursor.continue();
}

function on_fetch_feed(localFeed, event) {
  if(event.type !== 'success') {
    this.pendingFeedsCount--;
    on_complete.call(this);
    return;
  }

  // TODO: because both subscribe and poll call fetch feed and both need to
  // do the favicon lookup, then i think that it should be fetch feed's
  // responsibility?
  // the thing is, should that even be happening at the same time as fetch,
  // or does it occur on its own timeline

  // TODO: unmodified shouldn't prevent updating of favicon

  const remoteFeed = event.feed;
  if(localFeed.dateLastModified && remoteFeed.dateLastModified &&
    localFeed.dateLastModified.getTime() ===
    remoteFeed.dateLastModified.getTime()) {
    console.debug('Feed unmodified', localFeed.get_url().toString());
    this.pendingFeedsCount--;
    on_complete.call(this);
    return;
  }

  const queryURL = remoteFeed.link ? remoteFeed.link : remoteFeed.get_url();
  lookup_favicon(queryURL, null, on_lookup_feed_favicon.bind(this, localFeed,
    remoteFeed, event.entries));
}

function on_lookup_feed_favicon(localFeed, remoteFeed, entries, faviconURL) {
  if(faviconURL) {
    remoteFeed.faviconURLString = faviconURL.href;
  }

  // Synchronize the feed loaded from the database with the fetched feed, and
  // then store the modified feed object in the database.
  const mergedFeed = merge_feeds(localFeed, remoteFeed);
  update_feed(this.connection, mergedFeed,
    on_update_feed.bind(this, entries));
}

function on_update_feed(entries, event) {
  if(event.type !== 'success') {
    this.pendingFeedsCount--;
    on_complete.call(this);
    return;
  }

  if(!entries || !entries.length) {
    this.pendingFeedsCount--;
    on_complete.call(this);
    return;
  }

  // TODO: instead of passing along the feed, just shove it in feed context
  // and pass along feed context instead
  // or just pass along only the relevant fields needed like feedId and title
  // and faviconURLString

  const feedContext = {
    'entriesProcessed': 0,
    'entriesAdded': 0,
    'numEntries': entries.length
  };

  const on_processed = on_entry_processed.bind(this, feedContext);
  for(let entry of entries) {
    process_entry.call(this, event.feed, entry, on_processed);
  }
}

function process_entry(feed, entry, callback) {
  if(!entry.has_url()) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  entry.add_url(rewrite_url(entry.get_url()));

  const transaction = this.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('urls');
  const request = index.get(entry.get_url().href);
  const on_find = on_find_entry.bind(this, feed, entry, callback);
  request.onsuccess = on_find;
  request.onerror = on_find;
}

function on_find_entry(feed, entry, callback, event) {
  if(event.type !== 'success') {
    callback();
    return;
  }

  if(event.target.result) {
    callback();
    return;
  }

  entry.feed = feed.id;
  if(feed.faviconURLString) {
    entry.faviconURLString = feed.faviconURLString;
  }

  // This denormalization avoids
  // the need to query for the feed's title when displaying the entry. The
  // catch is that if a feed's title later changes, the change is not
  // reflected in entry's previously stored.
  // feed.title was sanitized earlier when updating the feed
  if(feed.title) {
    entry.feedTitle = feed.title;
  }

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so.
  if(is_fetch_resistant(entry.get_url())) {
    add_entry(this.connection, entry, callback);
    return;
  }

  // Check if the entry url does not point to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, responseXML will be undefined in fetch_html so false
  // negatives are not too important.
  const path = entry.get_url().pathname;
  const minLen = '/a.pdf'.length;
  if(path && path.length > minLen && /\.pdf$/i.test(path)) {
    add_entry(this.connection, entry, callback);
    return;
  }

  const timeout_ms = 10 * 1000;
  fetch_html(entry.get_url(), timeout_ms,
    on_fetch_entry.bind(this, entry, callback));
}

function on_fetch_entry(entry, callback, event) {
  if(event.type !== 'success') {
    add_entry(this.connection, entry, callback);
    return;
  }

  entry.add_url(event.responseURL);

  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its faviconURL.
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const document = event.document;
  transform_lazy_images(document);
  filter_sourceless_images(document);
  resolve_document_urls(document, event.responseURL);
  filter_tracking_images(document);
  set_image_dimensions(document,
    on_set_image_dimensions.bind(this, entry, document, callback));
}

function on_set_image_dimensions(entry, document, callback, numImagesModified) {
  const content = document.documentElement.outerHTML.trim();
  if(content) {
    entry.content = content;
  }

  add_entry(this.connection, entry, callback);
}

function add_entry(connection, entry, callback) {
  console.assert(entry);
  console.assert(entry.get_url());
  console.debug('Storing', entry.get_url().toString());

  let sanitized = sanitize_entry(entry);
  let storable = serialize_entry(sanitized);
  storable.readState = Entry.FLAGS.UNREAD;
  storable.archiveState = Entry.FLAGS.UNARCHIVED;
  storable.dateCreated = new Date();

  const transaction = connection.transaction('entry', 'readwrite');
  const entryStore = transaction.objectStore('entry');
  const request = entryStore.add(storable);
  request.onsuccess = callback;
  request.onerror = function(event) {
    console.error(event.target.error);
    callback(event);
  };
}

function on_entry_processed(feedContext, event) {
  feedContext.entriesProcessed++;
  console.assert(feedContext.entriesProcessed <= feedContext.numEntries);

  if(event && event.type === 'success') {
    feedContext.entriesAdded++;
  }

  if(feedContext.entriesProcessed === feedContext.numEntries) {
    if(feedContext.entriesAdded) {
      update_badge(this.connection);
    }

    this.pendingFeedsCount--;
    on_complete.call(this);
  }
}

// Called whenever a feed finishes processing, or when there
// were no feeds to process.
function on_complete() {
  if(this.pendingFeedsCount) {
    return;
  }

  notify('Updated articles', 'Completed checking for new articles');
  if(this.connection) {
    this.connection.close();
  }

  release_lock();
  console.log('Polling completed');
}

// Obtain a poll lock by setting a flag in local storage. This uses local
// storage instead of global scope because the background page that calls out
// to poll.start occassionally unloads and reloads itself instead of remaining
// persistently open, which would reset the value of the global scope variable
// each page load. When polling determines if the poll is locked, it only
// checks for the presence of the key, and ignores the value, so the value I
// specify here is unimportant.
function acquire_lock() {
  localStorage.POLL_IS_ACTIVE = 'true';
}

function release_lock() {
  delete localStorage.POLL_IS_ACTIVE;
}

function is_locked() {
  return 'POLL_IS_ACTIVE' in localStorage;
}

} // End file block scope
