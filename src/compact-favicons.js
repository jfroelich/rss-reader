// See license.md

'use strict';

{

function compactFavicons(cache, log) {
  if(!Number.isInteger(cache.maxAge)) {
    throw new TypeError(`invalid maxAge ${cache.maxAge}`);
  }

  log.log('Compacting favicon cache, max age:', cache.maxAge);
  const ctx = {
    'cache': cache,
    'maxAge': cache.defaultMaxAge,
    'log': log,
    'numDeleted': 0,
    'numVisited': 0
  };
  cache.connect(connectOnSuccess.bind(ctx), connectOnError.bind(ctx));
}

function connectOnSuccess(event) {
  this.log.debug('Connected to database');
  const conn = event.target.result;
  const tx = this.cache.openCursor(conn, openCursorOnSuccess.bind(this),
    openCursorOnError.bind(this));
  tx.oncomplete = onComplete.bind(this);
  conn.close();
}

function connectOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this);
}

function openCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  this.numVisited++;

  const entry = cursor.value;
  if(this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Deleting favicon entry', entry.pageURLString);
    this.numDeleted++;
    const deleteRequest = cursor.delete();
    deleteRequest.onsuccess = deleteOnSuccess.bind(this, entry.pageURLString);
  } else {
    this.log.debug('Retaining favicon entry', entry.pageURLString,
      new Date() - entry.dateUpdated);
  }

  cursor.continue();
}

function deleteOnSuccess(url, event) {
  this.log.debug('Deleted favicon entry with url', url);
}

function openCursorOnError(event) {
  this.log.error(event.target.error);
}

function onComplete(event) {
  this.log.log('Compacted favicon cache, scanned %s, deleted %s',
    this.numVisited, this.numDeleted);
}

this.compactFavicons = compactFavicons;

}
