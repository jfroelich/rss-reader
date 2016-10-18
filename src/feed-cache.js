// See license.md

'use strict';

// TODO: there is no need to have a class, just use separate global functions
// and have each accept a log parameter, and rename them to clarify it is
// storage related

class FeedCache {

constructor(log) {
  this.log = log || SilentConsole;
}

add_entry(conn, entry, callback) {
  this.log.log('Adding entry', get_entry_url(entry));
  const sanitized = sanitize_entry(entry);
  const storable = filter_empty_props(sanitized);
  storable.readState = ENTRY_UNREAD;
  storable.archiveState = ENTRY_UNARCHIVED;
  storable.dateCreated = new Date();
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storable);
  request.onsuccess = callback;
  request.onerror = this._add_entry_on_error.bind(this, storable, callback);
}

_add_entry_on_error(entry, callback, event) {
  this.log.error(get_entry_url(entry), event.target.error);
  callback(event);
}

add_feed(conn, feed, callback) {
  if('id' in feed)
    throw new TypeError();

  this.log.log('Adding feed', get_feed_url(feed));
  let storable = sanitize_feed(feed);
  storable.dateCreated = new Date();
  storable = filter_empty_props(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = this._add_feed_on_success.bind(this, feed, callback);
  request.onerror = this._add_feed_on_error.bind(this, feed, callback);
}

_add_feed_on_success(feed, callback, event) {
  feed.id = event.target.result;
  this.log.debug('Added feed %s with new id %s', get_feed_url(feed), feed.id);
  callback({'type': 'success', 'feed': feed});
}

_add_feed_on_error(feed, callback, event) {
  this.log.error('Error adding feed', get_feed_url(feed), event.target.error);
  callback({'type': 'error'});
}

// Calls back with whether the db contains a feed with the given url
// TODO: normalize feed url?
has_feed_url(conn, url, callback) {
  this.log.debug('Checking for feed with url', url);
  const tx = conn.transaction('feed');
  const store = tx.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(url);
  request.onsuccess = this._has_feed_url_on_success.bind(this, url, callback);
  request.onerror = this._has_feed_url_on_error.bind(this, url, callback);
}

_has_feed_url_on_success(url, callback, event) {
  const feed = event.target.result;
  this.log.debug('Found feed with url %s? %s', url, !!feed);
  callback(!!feed);
}

_has_feed_url_on_error(url, callback, event) {
  this.log.debug(event.target.error);
  callback(false);
}

// Assumes urls are normalized
find_entry(conn, urls, limit, callback) {
  if(!urls.length)
    throw new TypeError();

  this.log.log('Find entry', urls);

  const ctx = {};
  ctx.urls = urls;
  ctx.matches = [];
  ctx.callback = callback;
  ctx.limit = limit || 0;
  ctx.reached_limit = false;

  const tx = conn.transaction('entry');
  tx.oncomplete = this._find_entry_on_complete.bind(this, ctx);
  const store = tx.objectStore('entry');
  const index = store.index('urls');

  // Iterate in reverse to increase the chance of an earlier exit
  // TODO: this only would matter if we search the urls sequentially, but
  // we search concurrently
  for(let i = urls.length - 1; i > -1; i--) {
    const request = index.openCursor(urls[i]);
    request.onsuccess = this._find_entry_open_cursor_on_success.bind(this, ctx);
    request.onerror = this.log.error;
  }
}

_find_entry_open_cursor_on_success(ctx, event) {
  if(ctx.reached_limit)
    return;

  const cursor = event.target.result;
  if(!cursor)
    return;

  const entry = cursor.value;

  // TODO: avoid pushing dups
  ctx.matches.push(entry);

  if(ctx.limit && ctx.matches.length >= ctx.limit) {
    ctx.reached_limit = true;
    return;
  }

  cursor.continue();
}

_find_entry_on_complete(ctx, event) {
  this.log.log('Found %s entries for [%s]', ctx.matches.length,
    ctx.urls.join(','));
  ctx.callback(ctx.matches);
}

put_feed(conn, feed, callback) {
  feed.dateUpdated = new Date();
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = this._put_feed_on_success.bind(this, feed, callback);
  request.onerror = this._put_feed_on_error.bind(this, feed, callback);
  return tx;
}

_put_feed_on_success(feed, callback, event) {
  this.log.debug('Successfully put feed', get_feed_url(feed));
  if(!('id' in feed)) {
    this.log.debug('Setting put feed new id to', event.target.result);
    feed.id = event.target.result;
  }
  callback('success', feed);
}

_put_feed_on_error(feed, callback, event) {
  this.log.debug('Error putting feed', get_feed_url(feed), event.target.error);
  callback('error');
}

update_feed(conn, feed, callback) {
  if(!('id' in feed))
    throw new TypeError();

  this.log.log('Updating feed', get_feed_url(feed));
  let storable = sanitize_feed(feed);
  storable.dateUpdated = new Date();
  storable = filter_empty_props(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = this._update_feed_on_success.bind(this, storable,
    callback);
  request.onerror = this._update_feed_on_error.bind(this, storable, callback);
}

_update_feed_on_success(feed, callback, event) {
  this.log.debug('Updated feed', get_feed_url(feed));
  if(callback)
    callback({'type': 'success', 'feed': feed});
}

_update_feed_on_error(feed, callback, event) {
  this.log.error('Error updating feed', get_feed_url(feed), event.target.error);
  if(callback)
    callback({'type': 'error', 'feed': feed});
}

get_all_feeds(conn, callback) {
  this.log.log('Opening cursor over feed store');
  const feeds = [];
  const tx = conn.transaction('feed');
  tx.oncomplete = this._get_all_feeds_on_complete.bind(this, feeds, callback);
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = this._get_all_feeds_open_cursor_on_success.bind(this,
    feeds);
  request.onerror = this.log.error;
}

_get_all_feeds_open_cursor_on_success(feeds, event) {
  const cursor = event.target.result;
  if(cursor) {
    feeds.push(cursor.value);
    cursor.continue();
  }
}

_get_all_feeds_on_complete(feeds, callback, event) {
  this.log.log('Loaded %s feeds', feeds.length);
  callback(feeds);
}

count_unread_entries(conn, callback) {
  this.log.debug('Counting unread entries');
  const tx = conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_UNREAD);
  request.onsuccess = this._count_unread_entries_on_success.bind(this,
    callback);
  request.onerror = this._count_unread_entries_on_error.bind(this, callback);
}

_count_unread_entries_on_success(callback, event) {
  const count = event.target.result;
  callback(count);
}

_count_unread_entries_on_error(callback, event) {
  this.log.error(event.target.error);
  callback(-1);// 0 would be ambiguous
}

mark_entry_read(id, callback) {
  if(!Number.isInteger(id) || id < 1) {
    throw new TypeError();
  }

  this.log.debug('Starting to mark entry %s as read', id);
  const ctx = {'id': id, 'callback': callback};
  const db = new FeedDb();
  db.connect(this._mark_entry_read_connect_on_success.bind(this, ctx),
    this._mark_entry_read_connect_on_error.bind(this, ctx));
}

// Mark entry read open database on success
_mark_entry_read_connect_on_success(ctx, conn) {
  this.log.debug('Connected to database to mark entry as read');
  ctx.conn = conn;
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(ctx.id);
  request.onsuccess = this._mark_entry_read_open_cursor_on_success.bind(this,
    ctx);
  request.onerror = this._mark_entry_read_open_cursor_on_error.bind(this, ctx);
}

// Mark entry read open database on error
_mark_entry_read_connect_on_error(ctx) {
  this._mark_entry_read_on_complete(ctx, 'ConnectionError');
}

// Mark entry read open cursor on success
_mark_entry_read_open_cursor_on_success(ctx, event) {
  const cursor = event.target.result;
  if(!cursor) {
    this.log.error('No entry found with id', ctx.id);
    this._mark_entry_read_on_complete(ctx, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === ENTRY_READ) {
    this.log.error('Already read entry with id', entry.id);
    this._mark_entry_read_on_complete(ctx, 'AlreadyReadError');
    return;
  }

  this.log.debug('Updating entry', entry.id);

  entry.readState = ENTRY_READ;
  const current_date = new Date();
  entry.dateRead = current_date;
  entry.dateUpdated = current_date;
  cursor.update(entry);

  update_badge(ctx.conn, SilentConsole);
  this._mark_entry_read_on_complete(ctx, 'Success');
}

// Mark entry read open cursor on error
_mark_entry_read_open_cursor_on_error(ctx, event) {
  this.log.error(event.target.error);
  this._mark_entry_read_on_complete(ctx, 'CursorError');
}

// Mark entry read on complete
_mark_entry_read_on_complete(ctx, type) {
  this.log.log('Completed marking entry %s as read', this.id);
  if(ctx.conn) {
    this.log.debug('Requesting database to close');
    ctx.conn.close();
  }

  if(ctx.callback) {
    this.log.debug('Calling back with type', type);
    ctx.callback({'type': type});
  }
}

} // End class FeedCache
