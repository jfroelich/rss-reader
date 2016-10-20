// See license.md

'use strict';

{

this.archive_entries = function(db, max_age, log, callback) {
  if(typeof max_age !== 'undefined' &&
    (!Number.isInteger(max_age) || max_age < 0))
    throw new TypeError();

  const default_max_age = 10 * 24 * 60 * 60 * 1000;// 10 days in ms
  const ctx = {
    'num_scanned': 0,
    'num_modified': 0,
    'max_age': max_age || default_max_age,
    'db': db,
    'current_date': new Date(),
    'callback': callback,
    'log': log || SilentConsole
  };

  ctx.log.log('Archiving entries with max_age', ctx.max_age);
  db.connect(connect_on_success.bind(ctx), connect_on_error.bind(ctx));
};

function connect_on_success(conn) {
  // TODO: get db name from conn?
  this.log.debug('Connected to database', this.db.name);
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
  if(!cursor)
    return;
  const entry = cursor.value;
  const age = this.current_date - entry.dateCreated;
  if(age > this.max_age) {
    this.num_modified++;
    const compacted = compact_entry.call(this, entry);
    log_size.call(this, entry, compacted, age);
    cursor.update(compacted);
    send_message(entry);
  }
  this.num_scanned++;
  cursor.continue();
}

function send_message(entry) {
  const message = {'type': 'archive_entry_request', 'id': entry.id};
  chrome.runtime.send_message(message);
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
  if(entry.dateRead) {
    output.dateRead = entry.dateRead;
  }
  output.feed = entry.feed;
  output.id = entry.id;
  output.readState = entry.readState;
  output.urls = entry.urls;
  return output;
}

function on_complete(event) {
  this.log.log('Archive entries completed (scanned %s, compacted %s)',
    this.num_scanned, this.num_modified);
  if(this.callback) {
    this.callback();
  }
}

}
