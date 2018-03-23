import * as rdb from '/src/rdb/rdb.js';
import {sizeof} from '/src/sizeof/sizeof.js';

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export function Archiver() {
  this.conn = null;
  this.channel = null;
  this.max_age = TWO_DAYS_MS;
  this.console = null_console;
}

Archiver.prototype.open = async function() {
  this.conn = await rdb.open();
};

Archiver.prototype.close = function() {
  if (this.conn) {
    this.conn.close();
  }
};

Archiver.prototype.archive = function() {
  return new Promise((resolve, reject) => {
    this.console.log('Archiving entries...');
    const entry_ids = [];
    const current_date = new Date();

    const txn = this.conn.transaction('entry', 'readwrite');
    txn.onerror = _ => reject(txn.error);
    txn.oncomplete = _ => {
      if (this.channel) {
        for (const id of entry_ids) {
          this.channel.postMessage({type: 'entry-archived', id: id});
        }
      }

      this.console.debug('Archived %d entries', entry_ids.length);

      resolve(entry_ids);
    };

    const store = txn.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [rdb.ENTRY_STATE_UNARCHIVED, rdb.ENTRY_STATE_READ];
    const request = index.openCursor(key_path);
    request.onsuccess = _ => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      const entry = cursor.value;
      if (entry.dateCreated) {
        const age = current_date - entry.dateCreated;
        if (age > this.max_age) {
          const archived_entry = this.archive_entry(entry);
          store.put(archived_entry);
          entry_ids.push(archived_entry.id);
        }
      }

      cursor.continue();
    };
  });
};


Archiver.prototype.archive_entry = function(entry) {
  const before_sz = sizeof(entry);
  const ce = this.compact_entry(entry);
  const after_sz = sizeof(ce);
  this.console.debug('Reduced entry size by ~%d bytes', after_sz - before_sz);
  ce.archiveState = rdb.ENTRY_STATE_ARCHIVED;
  ce.dateArchived = new Date();
  ce.dateUpdated = new Date();
  return ce;
};

Archiver.prototype.compact_entry = function(entry) {
  const ce = rdb.entry_create();
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
