// See license.md

'use strict';

// TODO: merge with feed db
// TODO: merge entry.js and feed.js
// TODO: maybe merge add/put entry into one function

{

this.db_add_entry = function(log, conn, entry, callback) {
  log.log('Adding entry', get_entry_url(entry));
  const sanitized = sanitize_entry(entry);
  const storable = filter_empty_props(sanitized);
  storable.readState = ENTRY_UNREAD;
  storable.archiveState = ENTRY_UNARCHIVED;
  storable.dateCreated = new Date();
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storable);
  request.onsuccess = callback;
  request.onerror = add_entry_on_error.bind(request, log, storable, callback);
};

function add_entry_on_error(log, entry, callback, event) {
  log.error(event.target.error);
  callback(event);
}

this.db_add_feed = function(log, conn, feed, callback) {
  if('id' in feed)
    throw new TypeError();
  log.log('Adding feed', get_feed_url(feed));
  let storable = sanitize_feed(feed);
  storable.dateCreated = new Date();
  storable = filter_empty_props(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = add_feed_on_success.bind(request, log, feed, callback);
  request.onerror = add_feed_on_error.bind(request, log, feed, callback);
};

function add_feed_on_success(log, feed, callback, event) {
  feed.id = event.target.result;
  log.debug('Added feed %s with new id %s', get_feed_url(feed), feed.id);
  callback({'type': 'success', 'feed': feed});
}

function add_feed_on_error(log, feed, callback, event) {
  log.error(event.target.error);
  callback({'type': 'error'});
}

// Calls back with whether the db contains a feed with the given url
// TODO: rename to db_contains_feed_url
// TODO: normalize feed url?
this.db_has_feed_url = function(log, conn, url, callback) {
  log.debug('Checking for feed with url', url);
  const tx = conn.transaction('feed');
  const store = tx.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(url);
  request.onsuccess = has_feed_url_on_success.bind(request, log, url, callback);
  request.onerror = has_feed_url_on_error.bind(request, log, url, callback);
};

function has_feed_url_on_success(log, url, callback, event) {
  const feed = event.target.result;
  log.debug('Found feed with url %s? %s', url, !!feed);
  callback(!!feed);
}

function has_feed_url_on_error(log, url, callback, event) {
  log.debug(event.target.error);
  callback(false);
}

// Assumes urls are normalized
this.db_find_entry = function(log, conn, urls, limit, callback) {
  if(!urls.length)
    throw new TypeError();

  log.log('Find entry', urls);

  const ctx = {};
  ctx.matches = [];
  ctx.callback = callback;
  ctx.limit = limit || 0;
  ctx.reached_limit = false;

  const tx = conn.transaction('entry');
  tx.oncomplete = find_entry_on_complete.bind(tx, log, urls, ctx.matches);
  const store = tx.objectStore('entry');
  const index = store.index('urls');

  // Iterate in reverse to increase the chance of an earlier exit
  // TODO: this only would matter if we search the urls sequentially, but
  // we currently search concurrently
  for(let i = urls.length - 1; i > -1; i--) {
    const request = index.openCursor(urls[i]);
    request.onsuccess = find_entry_open_cursor_on_success.bind(request, ctx);
    request.onerror = log.error;
  }
};

function find_entry_open_cursor_on_success(ctx, event) {
  if(ctx.reached_limit)
    return;
  const cursor = event.target.result;
  if(!cursor)
    return;
  const entry = cursor.value;
  // TODO: avoid pushing dups?
  ctx.matches.push(entry);
  if(ctx.limit && ctx.matches.length >= ctx.limit) {
    ctx.reached_limit = true;
    return;
  }
  cursor.continue();
}

function find_entry_on_complete(log, urls, matches, event) {
  log.log('Found %s entries for [%s]', matches.length, urls.join(','));
  ctx.callback(matches);
}

this.db_put_feed = function(log, conn, feed, callback) {
  log.debug('Putting feed', get_feed_url(feed));
  feed.dateUpdated = new Date();
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = put_feed_on_success.bind(request, log, feed, callback);
  request.onerror = put_feed_on_error.bind(request, log, feed, callback);
  return tx;
};

function put_feed_on_success(log, feed, callback, event) {
  log.debug('Successfully put feed', get_feed_url(feed));
  if(!('id' in feed)) {
    log.debug('New feed id', event.target.result);
    feed.id = event.target.result;
  }
  if(callback)
    callback('success', feed);
}

function put_feed_on_error(log, feed, callback, event) {
  log.debug(event.target.error);
  if(callback)
    callback('error');
}

this.db_update_feed = function(log, conn, feed, callback) {
  if(!('id' in feed))
    throw new TypeError();
  log.log('Updating feed', get_feed_url(feed));
  let storable = sanitize_feed(feed);
  storable.dateUpdated = new Date();
  storable = filter_empty_props(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = update_feed_on_success.bind(request, log, storable,
    callback);
  request.onerror = update_feed_on_error.bind(request, log, storable, callback);
}

function update_feed_on_success(log, feed, callback, event) {
  log.debug('Updated feed', get_feed_url(feed));
  if(callback)
    callback({'type': 'success', 'feed': feed});
}

function update_feed_on_error(log, feed, callback, event) {
  log.error(event.target.error);
  if(callback)
    callback({'type': 'error', 'feed': feed});
}

this.db_get_all_feeds = function(log, conn, callback) {
  log.log('Opening cursor over feed store');
  const feeds = [];
  const tx = conn.transaction('feed');
  tx.oncomplete = get_all_feeds_on_complete.bind(tx, log, feeds, callback);
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = get_all_feeds_open_cursor_on_success.bind(request, feeds);
  request.onerror = log.error;
};

function get_all_feeds_open_cursor_on_success(feeds, event) {
  const cursor = event.target.result;
  if(cursor) {
    feeds.push(cursor.value);
    cursor.continue();
  }
}

function get_all_feeds_on_complete(log, feeds, callback, event) {
  log.log('Loaded %s feeds', feeds.length);
  callback(feeds);
}

this.db_count_unread_entries = function(log, conn, callback) {
  log.debug('Counting unread entries');
  const tx = conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_UNREAD);
  request.onsuccess = count_unread_entries_on_success.bind(request, callback);
  request.onerror = count_unread_entries_on_error.bind(request, log, callback);
};

function count_unread_entries_on_success(callback, event) {
  const count = event.target.result;
  callback(count);
}

function count_unread_entries_on_error(log, callback, event) {
  log.error(event.target.error);
  callback(-1);// 0 would be ambiguous
}

this.db_mark_entry_read = function(log, id, callback) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError();

  log.debug('Starting to mark entry %s as read', id);
  const ctx = {'id': id, 'callback': callback, 'log': log};
  const db = new FeedDb();
  // TODO: bind to ctx instead of as param
  db.connect(mark_entry_read_connect_on_success.bind(null, ctx),
    mark_entry_read_connect_on_error.bind(null, ctx));
};

function mark_entry_read_connect_on_success(ctx, conn) {
  ctx.log.debug('Connected to database to mark entry as read');
  ctx.conn = conn;
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(ctx.id);
  request.onsuccess = mark_entry_read_open_cursor_on_success.bind(request, ctx);
  request.onerror = mark_entry_read_open_cursor_on_error.bind(request, ctx);
}

function mark_entry_read_connect_on_error(ctx) {
  mark_entry_read_on_complete(ctx, 'ConnectionError');
}

function mark_entry_read_open_cursor_on_success(ctx, event) {
  const cursor = event.target.result;
  if(!cursor) {
    ctx.log.error('No entry found with id', ctx.id);
    mark_entry_read_on_complete(ctx, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === ENTRY_READ) {
    ctx.log.error('Already read entry with id', entry.id);
    mark_entry_read_on_complete(ctx, 'AlreadyReadError');
    return;
  }

  ctx.log.debug('Updating entry', entry.id);

  entry.readState = ENTRY_READ;
  const current_date = new Date();
  entry.dateRead = current_date;
  entry.dateUpdated = current_date;
  cursor.update(entry);

  update_badge(ctx.conn, ctx.log);
  mark_entry_read_on_complete(ctx, 'Success');
}

function mark_entry_read_open_cursor_on_error(ctx, event) {
  ctx.log.error(event.target.error);
  mark_entry_read_on_complete(ctx, 'CursorError');
}

function mark_entry_read_on_complete(ctx, type) {
  ctx.log.log('Completed marking entry %s as read', ctx.id);
  if(ctx.conn)
    ctx.conn.close();
  if(ctx.callback)
    ctx.callback({'type': type});
}

}
