// See license.md

'use strict';

// TODO: return a promise
// TODO: use async

// TODO: delegate the opening of a cursor over the entries to a function
// in feed-cache.js? The problem is that the abstraction is ridiculously
// thin. I need callbacks for oncomplete, onsuccess, and onerror, and I
// need to use readwrite mode instead of readonly, and an index and keypath
// parameter. So really the function needs to be incredibly specific to only
// this particular use. Which makes it difficult to justify moving it.

{

this.archive_entries = function(db_target, max_age, log, callback) {
  if(typeof max_age !== 'undefined' &&
    (!Number.isInteger(max_age) || max_age < 0))
    throw new TypeError();

  const default_max_age = 10 * 24 * 60 * 60 * 1000;// 10 days in ms
  const ctx = {
    'num_scanned': 0,
    'num_modified': 0,
    'max_age': max_age || default_max_age,
    'current_date': new Date(),
    'callback': callback,
    'log': log || SilentConsole
  };

  ctx.dbChannel = new BroadcastChannel('db');
  ctx.log.log('Archiving entries with max_age', ctx.max_age);

  let promise = db_connect(db_target, log);
  promise.then(connect_on_success.bind(ctx));
  promise.catch(connect_on_error.bind(ctx));
};

function connect_on_success(conn) {
  this.log.debug('Connected to database', conn.name);
  const tx = conn.transaction('entry', 'readwrite');
  tx.oncomplete = on_complete.bind(this);
  const store = tx.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_UNARCHIVED, ENTRY_READ];
  const request = index.openCursor(key_path);
  request.onsuccess = open_cursor_on_success.bind(this);
  request.onerror = open_cursor_on_error.bind(this);
  conn.close();
}

function connect_on_error() {
  on_complete.call(this);
}

function open_cursor_on_success(event) {
  const cursor = event.target.result;
  if(!cursor) {
    this.log.debug('cursor undefined');
    return;
  }

  const entry = cursor.value;
  const age = this.current_date - entry.dateCreated;
  this.log.debug('Visiting', get_entry_url(entry));
  if(age > this.max_age) {
    this.num_modified++;
    const compacted = compact_entry.call(this, entry);
    log_size.call(this, entry, compacted, age);
    cursor.update(compacted);
    send_message.call(this, entry);
  }
  this.num_scanned++;
  cursor.continue();
}

function send_message(entry) {
  const message = {'type': 'archive_entry_request', 'id': entry.id};
  this.dbChannel.postMessage(message);
}

function log_size(entry, compacted_entry, age) {
  if(this.log !== console)
    return; // sizeof is expensive
  const before = sizeof(entry);
  const after = sizeof(compacted_entry);
  this.log.debug('Compacted entry %s (age %s, before %s, after %s)',
    get_entry_url(entry), age, before, after);
}

function open_cursor_on_error(event) {
  this.log.error(event.target.error);
}

function compact_entry(entry) {
  const output = {};
  output.archiveState = ENTRY_ARCHIVED;
  output.dateArchived = this.current_date;
  output.dateCreated = entry.dateCreated;
  if(entry.dateRead)
    output.dateRead = entry.dateRead;
  output.feed = entry.feed;
  output.id = entry.id;
  output.readState = entry.readState;
  output.urls = entry.urls;
  return output;
}

function on_complete(event) {
  this.log.log('Archive entries completed (scanned %s, compacted %s)',
    this.num_scanned, this.num_modified);
  this.dbChannel.close();
  if(this.callback)
    this.callback();
}

}
