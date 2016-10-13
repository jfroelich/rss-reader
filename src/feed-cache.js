// See license.md

'use strict';

class FeedCache {

constructor(log) {
  this.log = log || SilentConsole;
}

addEntry(conn, entry, callback) {
  this.log.log('Adding entry', Entry.getURL(entry));
  const sanitized = Entry.sanitize(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.UNREAD;
  storable.archiveState = Entry.UNARCHIVED;
  storable.dateCreated = new Date();
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storable);
  request.onsuccess = callback;
  request.onerror = this._addEntryOnError.bind(this, storable, callback);
}

_addEntryOnError(entry, callback, event) {
  this.log.error(Entry.getURL(entry), event.target.error);
  callback(event);
}

addFeed(conn, feed, callback) {
  if('id' in feed) {
    throw new TypeError('Cannot add feed with id property');
  }

  this.log.log('Adding feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateCreated = new Date();
  storable = filterEmptyProps(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = this._addFeedOnSuccess.bind(this, feed, callback);
  request.onerror = this._addFeedOnError.bind(this, feed, callback);
}

_addFeedOnSuccess(feed, callback, event) {
  feed.id = event.target.result;
  this.log.debug('Added feed %s with new id %s', Feed.getURL(feed), feed.id);
  callback({'type': 'success', 'feed': feed});
}

_addFeedOnError(feed, callback, event) {
  this.log.error('Error adding feed', Feed.getURL(feed), event.target.error);
  callback({'type': 'error'});
}

// Calls back with whether the db contains a feed with the given url
// TODO: normalize feed url?
hasFeedURL(conn, url, callback) {
  this.log.debug('Checking for feed with url', url);
  const tx = conn.transaction('feed');
  const store = tx.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(url);
  request.onsuccess = this._hasFeedURLOnSuccess.bind(this, url, callback);
  request.onerror = this._hasFeedURLOnError.bind(this, url, callback);
}

_hasFeedURLOnSuccess(url, callback, event) {
  const feed = event.target.result;
  this.log.debug('Found feed with url %s? %s', url, !!feed);
  callback(!!feed);
}

_hasFeedURLOnError(url, callback, event) {
  this.log.debug(event.target.error);
  callback(false);
}

// Assumes urls are normalized
findEntry(conn, urls, limit, callback) {
  if(!urls.length) {
    throw new Error('At least one url is required');
  }

  this.log.log('Find entry', urls);

  const ctx = {};
  ctx.urls = urls;
  ctx.didCallback = false;
  ctx.matches = [];
  ctx.callback = callback;
  ctx.limit = limit || 0;
  ctx.reachedLimit = false;

  const tx = conn.transaction('entry');
  tx.oncomplete = this._findEntryOnComplete.bind(this, ctx);
  const store = tx.objectStore('entry');
  const index = store.index('urls');

  // Iterate in reverse to increase the chance of an earlier exit
  // TODO: this only would matter if we search the urls sequentially, but
  // we search concurrently
  for(let i = urls.length - 1; i > -1; i--) {
    const request = index.openCursor(urls[i]);
    request.onsuccess = this._findEntryOpenCursorOnSuccess.bind(this, ctx);
    request.onerror = this.log.error;
  }
}

_findEntryOpenCursorOnSuccess(ctx, event) {
  if(ctx.reachedLimit) {
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  const entry = cursor.value;

  // TODO: avoid pushing dups
  ctx.matches.push(entry);

  if(ctx.limit && ctx.matches.length >= ctx.limit) {
    ctx.reachedLimit = true;
    return;
  }

  cursor.continue();
}

_findEntryOnComplete(ctx, event) {
  this.log.log('Found %s entries for [%s]', ctx.matches.length,
    ctx.urls.join(','));
  ctx.callback(ctx.matches);
}

putFeed(conn, feed, callback) {
  feed.dateUpdated = new Date();

  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = this._putFeedOnSuccess.bind(this, feed, callback);
  request.onerror = this._putFeedOnError.bind(this, feed, callback);
  return tx;
}

_putFeedOnSuccess(feed, callback, event) {
  this.log.debug('Successfully put feed', Feed.getURL(feed));
  if(!('id' in feed)) {
    this.log.debug('Setting put feed new id to', event.target.result);
    feed.id = event.target.result;
  }
  callback('success', feed);
}

_putFeedOnError(feed, callback, event) {
  this.log.debug('Error putting feed', Feed.getURL(feed), event.target.error);
  callback('error');
}

updateFeed(conn, feed, callback) {
  if(!('id' in feed)) {
    throw new TypeError('Feed missing id');
  }

  this.log.log('Updating feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateUpdated = new Date();
  storable = filterEmptyProps(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = this._updateFeedOnSuccess.bind(this, storable, callback);
  request.onerror = this._updateFeedOnError.bind(this, storable, callback);
}

_updateFeedOnSuccess(feed, callback, event) {
  this.log.debug('Updated feed', Feed.getURL(feed));
  if(callback) {
    callback({'type': 'success', 'feed': feed});
  }
}

_updateFeedOnError(feed, callback, event) {
  this.log.error('Error updating feed', Feed.getURL(feed), event.target.error);
  if(callback) {
    callback({'type': 'error', 'feed': feed});
  }
}

getAllFeeds(conn, callback) {
  this.log.log('Opening cursor over feed store');
  const feeds = [];
  const tx = conn.transaction('feed');
  tx.oncomplete = this._getAllFeedsOnComplete.bind(this, feeds, callback);
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = this._getAllFeedsOpenCursorOnSuccess.bind(this, feeds);
  request.onerror = this.log.error;
}

_getAllFeedsOpenCursorOnSuccess(feeds, event) {
  const cursor = event.target.result;
  if(cursor) {
    const feed = cursor.value;
    feeds.push(feed);
    cursor.continue();
  }
}

_getAllFeedsOnComplete(feeds, callback, event) {
  this.log.log('Loaded %s feeds', feeds.length);
  callback(feeds);
}

countUnread(conn, callback) {
  this.log.debug('Counting unread entries');
  const tx = conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.UNREAD);
  request.onsuccess = this._countUnreadOnSuccess.bind(this, callback);
  request.onerror = this._countUnreadOnError.bind(this, callback);
}

_countUnreadOnSuccess(callback, event) {
  const count = event.target.result;
  callback(count);
}

_countUnreadOnError(callback, event) {
  this.log.error(event.target.error);
  callback(-1);// 0 would be ambiguous
}

markEntryRead(id, callback) {
  if(!Number.isInteger(id) || id < 1) {
    throw new Error(`invalid entry id ${id}`);
  }

  this.log.debug('Starting to mark entry %s as read', id);
  const ctx = {'id': id, 'callback': callback};
  const feedDb = new FeedDb();
  feedDb.open(this._merodbos.bind(this, ctx), this._merodboe.bind(this, ctx));
}

// Mark entry read open database on success
_merodbos(ctx, event) {
  this.log.debug('Connected to database to mark entry as read');
  const conn = event.target.result;
  ctx.conn = conn;
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(ctx.id);
  request.onsuccess = this._merocos.bind(this, ctx);
  request.onerror = this._merocoe.bind(this, ctx);
}

// Mark entry read open database on error
_merodboe(ctx, event) {
  this.log.debug(event.target.error);
  this._meroc(ctx, 'ConnectionError');
}

// Mark entry read open cursor on success
_merocos(ctx, event) {
  const cursor = event.target.result;
  if(!cursor) {
    this.log.error('No entry found with id', ctx.id);
    this._meroc(ctx, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.READ) {
    this.log.error('Already read entry with id', entry.id);
    this._meroc(ctx, 'AlreadyReadError');
    return;
  }

  this.log.debug('Updating entry', entry.id);

  entry.readState = Entry.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;
  cursor.update(entry);

  updateBadge(ctx.conn, SilentConsole);
  this._meroc(ctx, 'Success');
}

// Mark entry read open cursor on error
_merocoe(ctx, event) {
  this.log.error(event.target.error);
  this._meroc(ctx, 'CursorError');
}

// Mark entry read on complete
_meroc(ctx, type) {
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
