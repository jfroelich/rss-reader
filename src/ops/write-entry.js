import {filter_empty_properties} from '/src/lib/object.js';
import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry, is_valid_entry, is_valid_entry_id, sanitize_entry} from '/src/objects/entry.js';

export function write_entry(entry, validate = true) {
  // Throw immediately in case of a programmer error. This is a programmer
  // error.
  if (!is_entry(entry)) {
    throw new TypeError('entry is not an entry ' + entry);
  }

  return new Promise(executor.bind(this, storable_entry, validate));
}

function executor(entry, validate, resolve, reject) {
  // We do validation in the executor so that the exception is regarded
  // initially as a kind of promise rejection instead of an immediately thrown
  // exception, because a validation error is not a programmer error
  if (validate && !is_valid_entry(entry)) {
    throw new TypeError('invalid entry ' + entry);
  }

  const is_create = !is_valid_entry_id(storable_entry.id);
  let storable_entry;

  if (is_create) {
    const sanitized_entry = sanitize_entry(entry);
    storable_entry = filter_empty_properties(sanitized_entry);

    storable_entry.readState = ENTRY_STATE_UNREAD;
    storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
    storable_entry.dateCreated = new Date();
    delete storable_entry.dateUpdated;
  } else {
    // Overwriting, just point to it
    storable_entry = entry;
  }

  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete =
      txn_oncomplete.bind(this, storable_entry, is_create, resolve);

  const store = txn.objectStore('entry');
  const request = store.put(storable_entry);

  // Set the new id. For new entries this is the auto-increment value from
  // indexedDB. For existing entries this is the prior id (the same value).
  request.onsuccess = event => storable_entry.id = event.target.result;
  request.onerror = _ => reject(request.error);
}

function txn_oncomplete(entry, is_create, callback, event) {
  // TODO: eventually just use one message type, entry-write. But for now
  // maintain the previous protocol. Changing the message type involves a
  // review of all listeners and for now I am focused on local changes.
  // TODO: it should be entry-created, but the prior implementation was using
  // entry-added, so maintain the old type for now
  const type = is_create ? 'entry-added' : 'entry-updated';
  this.channel.postMessage({type: type, id: entry.id});

  const msg = is_create ? '%s: wrote new entry %d' : '%s: overwrote entry %d';
  this.console.debug(msg, write_entry.name, entry.id);

  callback(entry);
}
