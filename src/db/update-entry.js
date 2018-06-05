import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry, is_valid_entry_id} from '/src/entry.js';
import {log} from '/src/log.js';

// TODO: decouple from log.js

// Creates or overwrites an entry object in the app database. The input entry is
// modified so this function is impure. The dateUpdated property is set
// automatically. The entry is not sanitized nor validated. Some initial state
// is supplied automatically, such as marking a new entry as unread. If
// creating, then the id property should not exist. The database is modified
// even when a post message error occurs.
//
// Context: conn, channel
// Errors: TypeError, InvalidStateError, DOMException
// Returns: a promise that resolves to the entry's id
export function update_entry(entry) {
  return new Promise((resolve, reject) => {
    if (!is_entry(entry)) {
      throw new TypeError('Invalid entry argument ' + entry);
    }

    const is_create = !entry.id;

    // Implied setup
    if (is_create) {
      entry.readState = ENTRY_STATE_UNREAD;
      entry.archiveState = ENTRY_STATE_UNARCHIVED;
      entry.dateCreated = new Date();
      delete entry.dateUpdated;
    } else {
      entry.dateUpdated = new Date();
    }

    const txn = this.conn.transaction('entry', 'readwrite');

    // In order to avoid misrepresenting state, wait until the transaction
    // completes, and not merely the request, before posting a message or
    // resolving
    txn.oncomplete = _ => {
      const message = {type: 'entry-write', id: entry.id, 'create': is_create};
      log('%s: %o', update_entry.name, message);
      this.channel.postMessage(message);
      resolve(entry.id);
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const request = store.put(entry);

    // Do not listen for request errors. Request errors bubble up to
    // transactional errors, and we are already listening for transaction
    // errors.

    // put returns the keypath for both new and existing objects. We only care
    // about catching it when creating a new entry
    if (is_create) {
      request.onsuccess = _ => entry.id = request.result;
    }
  });
}
