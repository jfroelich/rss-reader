// See license.md

'use strict';

{

this.compact_favicons = function(cache, log = SilentConsole) {
  if(!Number.isInteger(cache.max_age))
    throw new TypeError();

  log.log('Compacting favicon cache using max age', cache.max_age);
  const ctx = {
    'cache': cache,
    'max_age': cache.max_age,
    'log': log,
    'num_deleted': 0,
    'num_scanned': 0
  };
  cache.connect(connect_on_success.bind(ctx), connect_on_error.bind(ctx));
};

function connect_on_success(event) {
  const conn = event.target.result;
  this.log.debug('Connected to database', conn.name);
  const tx = this.cache.open_cursor(conn, open_cursor_on_success.bind(this),
    open_cursor_on_error.bind(null, this.log));
  tx.oncomplete = on_complete.bind(this);
  conn.close();
}

function connect_on_error(event) {
  this.log.error(event.target.error);
  on_complete.call(this);
}

function open_cursor_on_success(event) {
  const cursor = event.target.result;
  if(!cursor)
    return;

  this.num_scanned++;

  const entry = cursor.value;
  if(this.cache.is_expired(entry, this.max_age)) {
    this.log.debug('Deleting favicon entry', entry.pageURLString);
    this.num_deleted++;
    const delete_request = cursor.delete();
    delete_request.onsuccess = delete_on_success.bind(delete_request, this.log,
      entry.pageURLString);
  } else {
    this.log.debug('Retaining favicon entry', entry.pageURLString,
      new Date() - entry.dateUpdated);
  }

  cursor.continue();
}

function delete_on_success(log, url, event) {
  log.debug('Deleted favicon entry with url', url);
}

function open_cursor_on_error(log, event) {
  log.error(event.target.error);
}

function on_complete(event) {
  this.log.log('Compacted favicon cache, scanned %s, deleted %s',
    this.num_scanned, this.num_deleted);
}

}
