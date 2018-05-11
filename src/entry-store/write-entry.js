import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry, is_valid_entry_id} from '/src/entry-store/entry.js';

// TODO: now that this no longer does validation or sanitization, there is no
// use case where the output object is needed, so revert this back to just
// returning id
// NOTE: no longer pure, this mutates input entry props, update docs
// NOTE: this no longer does validation or sanitization, now a caller concern
// NOTE: this automatically sets dateUpdated to run date

export function write_entry(entry) {
  return new Promise(executor.bind(this, entry));
}

function executor(entry, resolve, reject) {
  if (!is_entry(entry)) {
    throw new TypeError('Invalid entry argument ' + entry);
  }

  const is_create = !entry.id;

  // Implicitly set initial storage state for new entries, or set the date
  // updated property automatically
  if (is_create) {
    entry.readState = ENTRY_STATE_UNREAD;
    entry.archiveState = ENTRY_STATE_UNARCHIVED;
    entry.dateCreated = new Date();
    delete entry.dateUpdated;
  } else {
    // Force to now
    entry.dateUpdated = new Date();
  }

  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete = txn_oncomplete.bind(this, entry, is_create, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const request = store.put(entry);
  if (is_create) {
    request.onsuccess = _ => entry.id = request.result;
  }
}

function txn_oncomplete(entry, is_create, callback, event) {
  const message = {type: 'entry-write', id: entry.id, 'create': is_create};
  this.console.debug('%s: %o', write_entry.name, message);
  this.channel.postMessage(message);
  callback(entry);
}
