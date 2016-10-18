// See license.md

'use strict';

{

function compact_favicons(cache, log) {
  if(!Number.isInteger(cache.max_age)) {
    throw new TypeError(`invalid max_age ${cache.max_age}`);
  }

  log.log('Compacting favicon cache, max age:', cache.max_age);
  const ctx = {
    'cache': cache,
    'max_age': cache.defaultMaxAge,
    'log': log,
    'num_deleted': 0,
    'num_scanned': 0
  };
  cache.connect(connect_on_success.bind(ctx), connect_on_error.bind(ctx));
}

function connect_on_success(event) {
  this.log.debug('Connected to database');
  const conn = event.target.result;
  const tx = this.cache.open_cursor(conn, open_cursor_on_success.bind(this),
    open_cursor_on_error.bind(this));
  tx.oncomplete = on_complete.bind(this);
  conn.close();
}

function connect_on_error(event) {
  this.log.error(event.target.error);
  on_complete.call(this);
}

function open_cursor_on_success(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  this.num_scanned++;

  const entry = cursor.value;
  if(this.cache.is_expired(entry, this.max_age)) {
    this.log.debug('Deleting favicon entry', entry.pageURLString);
    this.num_deleted++;
    const delete_request = cursor.delete();
    delete_request.onsuccess = delete_on_success.bind(this,
      entry.pageURLString);
  } else {
    this.log.debug('Retaining favicon entry', entry.pageURLString,
      new Date() - entry.dateUpdated);
  }

  cursor.continue();
}

function delete_on_success(url, event) {
  this.log.debug('Deleted favicon entry with url', url);
}

function open_cursor_on_error(event) {
  this.log.error(event.target.error);
}

function on_complete(event) {
  this.log.log('Compacted favicon cache, scanned %s, deleted %s',
    this.num_scanned, this.num_deleted);
}

this.compact_favicons = compact_favicons;

}
