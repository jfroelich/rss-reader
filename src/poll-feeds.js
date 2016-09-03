// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// @param force_reset_lock {boolean} if true then polling continues even when
// locked
// @param allow_metered {boolean} if true then allow polling to continue on a
// metered connection
function poll_feeds(force_reset_lock, allow_metered) {
  console.log('Checking for new articles...');

  const context = {'num_feeds_pending': 0, 'connection': null};

  if(force_reset_lock) {
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
  if(!allow_metered && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    console.debug('Metered connection');
    on_complete.call(context);
    return;
  }

  // Check if idle and possibly cancel the poll or continue with polling
  if('ONLY_POLL_IF_IDLE' in localStorage) {
    const idle_period_secs = 30;
    chrome.idle.queryState(idle_period_secs, on_query_idle.bind(context));
  } else {
    open_db(on_open_db.bind(context));
  }
}

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
    request.onsuccess = open_feed_cursor_onsuccess.bind(this);
    request.onerror = open_feed_cursor_onerror.bind(this);
  } else {
    on_complete.call(this);
  }
}

function open_feed_cursor_onerror(event) {
  on_complete.call(this);
}

function open_feed_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    on_complete.call(this);
    return;
  }

  this.num_feeds_pending++;
  const feed = cursor.value;
  const exclude_entries_flag = false;
  const timeout_ms = 0;
  const feed_url = get_feed_url(feed);
  const url_obj = new URL(feed_url);
  const bound_on_fetch = on_fetch_feed.bind(this, feed);
  fetch_feed(url_obj, timeout_ms, exclude_entries_flag, bound_on_fetch);
  cursor.continue();
}

function on_fetch_feed(local_feed, event) {
  if(event.type !== 'success') {
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  const remote_feed = event.feed;
  if(is_feed_unmodified(local_feed, remote_feed)) {
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  const remote_feed_url = get_feed_url(remote_feed);
  const remote_feed_url_obj = new URL(remote_feed_url);

  const query_url = remote_feed.link ? new URL(remote_feed.link) :
    remote_feed_url_obj;
  const bound_on_lookup = on_lookup_feed_favicon.bind(this, local_feed,
    remote_feed, event.entries);
  const prefetched_doc = null;
  lookup_favicon(query_url, prefetched_doc, bound_on_lookup);
}

function is_feed_unmodified(local_feed, remote_feed) {
  return local_feed.dateLastModified && remote_feed.dateLastModified &&
    local_feed.dateLastModified.getTime() ===
    remote_feed.dateLastModified.getTime()
}

function on_lookup_feed_favicon(local_feed, remote_feed, entries, favicon_url) {
  if(favicon_url) {
    remote_feed.faviconURLString = favicon_url.href;
  }

  const feed = merge_feeds(local_feed, remote_feed);
  update_feed(this.connection, feed, on_update_feed.bind(this, entries));
}

function on_update_feed(entries, event) {
  if(event.type !== 'success') {
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  if(!entries || !entries.length) {
    this.num_feeds_pending--;
    on_complete.call(this);
    return;
  }

  // TODO: instead of passing along the feed, just shove it in feed context
  // and pass along feed context instead
  // or just pass along only the relevant fields needed like feedId and title
  // and faviconURLString

  const feed_context = {
    'num_entries_processed': 0,
    'num_entries_added': 0,
    'num_entries': entries.length
  };

  const bound_on_entry_processed = on_entry_processed.bind(this, feed_context);
  for(let entry of entries) {
    process_entry.call(this, event.feed, entry, bound_on_entry_processed);
  }
}

function process_entry(feed, entry, callback) {

  let entry_terminal_url_str = get_entry_url(entry);

  if(!entry_terminal_url_str) {
    console.warn('Entry missing url', entry);
    callback();
    return;
  }

  let entry_terminal_url_obj = new URL(entry_terminal_url_str);
  const rewritten_url_obj = rewrite_url(entry_terminal_url_obj);

  if(rewritten_url_obj) {
    append_entry_url(entry, rewritten_url_obj.href);
  }

  // The terminal url may have changed if it was rewritten and unique
  entry_terminal_url_str = get_entry_url(entry);
  entry_terminal_url_obj = new URL(entry_terminal_url_str);

  const normalized_url_obj = normalize_url(entry_terminal_url_obj);

  const transaction = this.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('urls');
  const request = index.get(normalized_url_obj.href);
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

  const entry_url_str = get_entry_url(entry);
  const entry_url_obj = new URL(entry_url_str);

  // Check that the url does not belong to a domain that obfuscates its content
  // with things like advertisement interception or full javascript. While these
  // documents can be fetched, there is no point to doing so.
  if(is_fetch_resistant(entry_url_obj)) {
    add_entry(this.connection, entry, callback);
    return;
  }

  // Check if the entry url does not point to a PDF. This limits the amount of
  // networking in the general case, even though the extension isn't a real
  // indication of the mime type and may have some false positives. Even if
  // this misses it, responseXML will be undefined in fetch_html so false
  // negatives are not too important.
  const path = entry_url_obj.pathname;
  const min_len = '/a.pdf'.length;
  if(path && path.length > min_len && /\.pdf$/i.test(path)) {
    add_entry(this.connection, entry, callback);
    return;
  }

  const timeout_ms = 10 * 1000;
  const bound_on_fetch_entry = on_fetch_entry.bind(this, entry, callback);
  fetch_html(entry_url_obj, timeout_ms, bound_on_fetch_entry);
}

function on_fetch_entry(entry, callback, event) {
  if(event.type !== 'success') {
    add_entry(this.connection, entry, callback);
    return;
  }

  // Append the response url in case of a redirect
  const response_url_str = event.responseURL.href;
  console.assert(response_url_str);
  append_entry_url(entry, response_url_str);


  // TODO: if we successfully fetched the entry, then before storing it,
  // we should be trying to set its favicon_url.
  // - i shouldn't be using the feed's favicon url, that is unrelated
  // - i should pass along the html of the associated html document. the
  // lookup should not fetch a second time.
  // - i should be querying against the redirect url

  const doc = event.document;
  transform_lazy_images(doc);
  filter_sourceless_images(doc);
  resolve_document_urls(doc, event.responseURL);
  filter_tracking_images(doc);
  const next = on_set_image_dimensions.bind(this, entry, doc, callback);
  set_image_dimensions(doc, next);
}

function on_set_image_dimensions(entry, document, callback, num_modified) {
  const content = document.documentElement.outerHTML.trim();
  if(content) {
    entry.content = content;
  }

  add_entry(this.connection, entry, callback);
}

function on_entry_processed(feed_context, event) {
  feed_context.num_entries_processed++;
  const count = feed_context.num_entries_processed;
  console.assert(count <= feed_context.num_entries);

  if(event && event.type === 'success') {
    feed_context.num_entries_added++;
  }

  if(count === feed_context.num_entries) {
    if(feed_context.num_entries_added) {
      update_badge(this.connection);
    }

    this.num_feeds_pending--;
    on_complete.call(this);
  }
}

// Called whenever a feed finishes processing, or when there
// were no feeds to process.
function on_complete() {
  if(this.num_feeds_pending) {
    return;
  }

  notify('Updated articles', 'Completed checking for new articles');
  if(this.connection) {
    this.connection.close();
  }

  release_lock();
  console.log('Polling completed');
}

function normalize_url(url) {
  let clone = clone_url(url);
  // Strip the hash
  clone.hash = '';
  return clone;
}

function clone_url(url) {
  return new URL(url.href);
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

this.poll_feeds = poll_feeds;

} // End file block scope
