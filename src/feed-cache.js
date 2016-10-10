// See license.md

'use strict';

function FeedCache(log) {
  this.log = log || SilentConsole;
}

FeedCache.prototype.addEntry = function(conn, entry, callback) {
  this.log.log('Adding entry', Entry.getURL(entry));
  const sanitized = Entry.sanitize(entry);
  const storable = ReaderUtils.filterEmptyProps(sanitized);
  storable.readState = Entry.flags.UNREAD;
  storable.archiveState = Entry.flags.UNARCHIVED;
  storable.dateCreated = new Date();
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.add(storable);
  request.onsuccess = callback;
  request.onerror = this._addEntryOnError.bind(this, storable, callback);
};

FeedCache.prototype._addEntryOnError = function(entry, callback, event) {
  this.log.error(Entry.getURL(entry), event.target.error);
  callback(event);
};

FeedCache.prototype.addFeed = function(conn, feed, callback) {
  if('id' in feed) {
    throw new TypeError('cannot add feed with id');
  }

  this.log.log('Adding feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateCreated = new Date();
  storable = ReaderUtils.filterEmptyProps(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = this._addFeedOnSuccess.bind(this, feed, callback);
  request.onerror = this._addFeedOnError.bind(this, feed, callback);
};

FeedCache.prototype._addFeedOnSuccess = function(feed, callback, event) {
  feed.id = event.target.result;
  this.log.debug('Added feed %s with new %s', Feed.getURL(feed), feed.id);
  callback({'type': 'success', 'feed': feed});
};

FeedCache.prototype._addFeedOnError = function(feed, callback, event) {
  this.log.error('Error adding feed', Feed.getURL(feed), event.target.error);
  callback({'type': 'error'});
};

/*
TODO: profiling shows this is one of the slowest functions of the
backend polling process. It is probably the length of time it takes to do
the index lookup. Maybe there is a way to speed it up. Maybe part of the
issue is that I am deserializing entries, and it would be faster to use
a keyed cursor and just return entry ids. After all, I know that the one
calling context where this function is called is in polling, and that is
just to check if an entry exists. If I use a keyCursor then maybe idb is
smart enough to skip the deserialization of the full entry.

TODO: it doesn't actually make sense to always lookup all urls here.
Right now I merely stop appending matches, but I still continue to perform
all lookups. It would be better to not even continue to do lookups if I
reached the limit. Therefore I shouldn't be using a for loop. I should be
using continuation calling to reach the end, and at each async step,
deciding whether to do the next step or end. It is all serial in the end,
because even though the lookups are async, I don't think there is any
performance benefit to doing them in parallel. If all entries are going
to be iterated, then the same amount of work has to occur.
Well, there is a benefit to doing concurrent reads. The issue is that I think
it actually takes longer to call any request after the first.
Or maybe the reads are fast than this is hanging on some external tx
*/

FeedCache.prototype.findEntry = function(conn, urls, limit, callback) {

  if(!urls.length) {
    throw new Error('at least one url is required');
  }

  this.log.log('find entries with urls', urls);

  const ctx = {};
  ctx.didCallback = false;
  ctx.matches = [];
  ctx.callback = callback;
  ctx.limit = limit || 0;
  ctx.reachedLimit = false;

  const tx = conn.transaction('entry');
  tx.oncomplete = this._findEntryOnComplete.bind(this, ctx);
  const store = tx.objectStore('entry');
  const index = store.index('urls');

  // The urls input generally comes from an array of urls, where the earlier
  // urls have redirected or been rewritten to the later urls. The later url
  // is what is most likely to match then in cases where two entries are the
  // same due to redirects. By reversing, this searches for the redirected urls
  // first, before the original urls. Redirected urls are more likely to be
  // found, which can lead to fewer cursor requests and an earlier exit.
  // Shallow clone because reverse mutates and as policy want to avoid
  // mutating parameters.
  // I could skip clone and just iterate in reverse but this is terser.
  let reversed = [...urls];
  reversed.reverse();

  // Fire off concurrent requests for each of the input urls
  for(let url of reversed) {
    // TODO: was normalization already done implicitly?
    const normURL = Entry.normalizeURL(url);
    const request = index.openCursor(normURL);
    request.onsuccess = this._findEntryOpenCursorOnSuccess.bind(this, ctx);
    request.onerror = this.log.error;
  }
};

FeedCache.prototype._findEntryOpenCursorOnSuccess = function(ctx, event) {
  if(ctx.reachedLimit) {
    this.log.debug('ignoring entry because limit reached');
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    this.log.debug('undefined cursor');
    return;
  }

  const entry = cursor.value;

  this.log.debug('appending match', Entry.getURL(entry));
  // TODO: avoid pushing dups
  ctx.matches.push(entry);

  if(ctx.limit && ctx.matches.length >= ctx.limit) {
    this.log.debug('reached limit');
    ctx.reachedLimit = true;
    return;
  }

  cursor.continue();
};

FeedCache.prototype._findEntryOnComplete = function(ctx, event) {
  this.log.log('Found %s matches', ctx.matches.length);
  ctx.callback(ctx.matches);
};

FeedCache.prototype.updateFeed = function(conn, feed, callback) {
  if(!('id' in feed)) {
    throw new TypeError('missing id');
  }

  this.log.log('Updating feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateUpdated = new Date();
  storable = ReaderUtils.filterEmptyProps(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = this._updateFeedOnSuccess.bind(this, storable, callback);
  request.onerror = this._updateFeedOnError.bind(this, storable, callback);
};

FeedCache.prototype._updateFeedOnSuccess = function(feed, callback, event) {
  this.log.debug('Updated feed', Feed.getURL(feed));
  if(callback) {
    callback({'type': 'success', 'feed': feed});
  }
};

FeedCache.prototype._updateFeedOnError = function(feed, callback, event) {
  this.log.error('Error updating feed', Feed.getURL(feed), event.target.error);
  if(callback) {
    callback({'type': 'error', 'feed': feed});
  }
};

FeedCache.prototype.getAllFeeds = function(conn, callback) {
  this.log.log('Getting all feeds');
  const feeds = [];
  const tx = conn.transaction('feed');
  tx.oncomplete = this._getAllFeedsOnComplete.bind(this, feeds, callback);
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = this._getAllFeedsOpenCursorOnSuccess.bind(this, feeds);
  request.onerror = this.log.error;
};

FeedCache.prototype._getAllFeedsOpenCursorOnSuccess = function(feeds, event) {
  const cursor = event.target.result;
  if(cursor) {
    const feed = cursor.value;
    this.log.debug('Appending feed', Feed.getURL(feed));
    feeds.push(feed);
    cursor.continue();
  }
};

FeedCache.prototype._getAllFeedsOnComplete = function(feeds, callback, event) {
  this.log.log('Completed getting all feeds');
  callback(feeds);
};

FeedCache.prototype.countUnread = function(conn, callback) {
  this.log.debug('Counting unread entries');
  const tx = conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.flags.UNREAD);
  request.onsuccess = this._countUnreadOnSuccess.bind(this, callback);
  request.onerror = this._countUnreadOnError.bind(this, callback);
};

FeedCache.prototype._countUnreadOnSuccess = function(callback, event) {
  const count = event.target.result;
  callback(count);
};

FeedCache.prototype._countUnreadOnError = function(callback, event) {
  this.log.error(event.target.error);
  // Calling back with 0 would be ambiguous
  callback(-1);
};

FeedCache.prototype.markEntryRead = function(id, callback) {
  // TODO: use string template for error text
  if(!Number.isInteger(id) || id < 1) {
    throw new Error('invalid entry id: ' + id);
  }

  this.log.debug('Mark entry %s as read', id);
  const ctx = {'id': id, 'callback': callback};
  const feedDb = new FeedDb();
  feedDb.open(this._merodbos.bind(this, ctx), this._merodboe.bind(this, ctx));
};

// Mark entry read open database on success
FeedCache.prototype._merodbos = function(ctx, event) {
  this.log.debug('connected to database to mark entry as read');
  const conn = event.target.result;
  ctx.conn = conn;
  const tx = conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(ctx.id);
  request.onsuccess = this._merocos.bind(this, ctx);
  request.onerror = this._merocoe.bind(this, ctx);
};

// Mark entry read open database on error
FeedCache.prototype._merodboe = function(ctx, event) {
  this.log.debug(event.target.error);
  this._meroc(ctx, 'ConnectionError');
};

// Mark entry read open cursor on success
FeedCache.prototype._merocos = function(ctx, event) {
  const cursor = event.target.result;
  if(!cursor) {
    this.log.error('no entry found with id', ctx.id);
    this._meroc(ctx, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === Entry.flags.READ) {
    this.log.error('already read entry with id', entry.id);
    this._meroc(ctx, 'AlreadyReadError');
    return;
  }

  this.log.debug('Updating entry', entry.id);

  entry.readState = Entry.flags.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;
  cursor.update(entry);

  updateBadge(ctx.conn, SilentConsole);
  this._meroc(ctx, 'Success');
};

// Mark entry read open cursor on error
FeedCache.prototype._merocoe = function(ctx, event) {
  this.log.error(event.target.error);
  this._meroc(ctx, 'CursorError');
};

// Mark entry read on complete
FeedCache.prototype._meroc = function(ctx, type) {
  this.log.log('completed marking entry as read');
  if(ctx.conn) {
    this.log.debug('requesting database to close');
    ctx.conn.close();
  }

  if(ctx.callback) {
    this.log.debug('calling back with type', type);
    ctx.callback({'type': type});
  }
};
