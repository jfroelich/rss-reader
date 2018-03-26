import {rdr_conn_close, rdr_conn_create} from '/src/app/handles/rdr-conn.js';
import {entry_create, ENTRY_STATE_ARCHIVED, ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED} from '/src/app/objects/entry.js';

import {sizeof} from '/src/lib/sizeof/sizeof.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export function Archiver() {
  this.conn = null;
  this.channel = null;
  this.max_age = TWO_DAYS_MS;
  this.console = null_console;
}

Archiver.prototype.open = async function() {
  this.conn = await rdr_conn_create();
};

Archiver.prototype.close = function() {
  rdr_conn_close(this.conn);
};

Archiver.prototype.archive = function() {
  return new Promise((resolve, reject) => {
    this.console.log('Archiving entries...');
    const entry_ids = [];
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.onerror = _ => reject(txn.error);
    txn.oncomplete = this.txn_oncomplete.bind(this, entry_ids, resolve);
    const store = txn.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.openCursor(key_path);
    request.onsuccess = this.handle_cursor.bind(this, entry_ids);
  });
};

Archiver.prototype.txn_oncomplete = function(entry_ids, callback) {
  if (this.channel) {
    for (const id of entry_ids) {
      this.channel.postMessage({type: 'entry-archived', id: id});
    }
  }

  this.console.debug('Archived %d entries', entry_ids.length);
  callback(entry_ids);
};

Archiver.prototype.handle_cursor = function(entry_ids, event) {
  const cursor = event.target.result;
  if (!cursor) {
    return;
  }

  const entry = cursor.value;
  if (entry.dateCreated) {
    const current_date = new Date();
    const age = current_date - entry.dateCreated;
    if (age > this.max_age) {
      const ae = this.archive_entry(entry);
      cursor.update(ae);
      entry_ids.push(ae.id);
    }
  }

  cursor.continue();
};

Archiver.prototype.archive_entry = function(entry) {
  const before_sz = sizeof(entry);
  const ce = this.compact_entry(entry);
  const after_sz = sizeof(ce);
  this.console.debug('Reduced entry size by ~%d bytes', after_sz - before_sz);
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  ce.dateArchived = new Date();
  ce.dateUpdated = new Date();
  return ce;
};

Archiver.prototype.compact_entry = function(entry) {
  const ce = entry_create();
  ce.dateCreated = entry.dateCreated;

  if (entry.dateRead) {
    ce.dateRead = entry.dateRead;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  return ce;
};

function noop() {}

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};
