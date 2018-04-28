import {filter_empty_properties} from '/src/lib/object.js';
import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry, is_valid_entry, is_valid_entry_id, sanitize_entry} from '/src/objects/entry.js';

export function write_entry(entry, validate = true) {
  if (!is_entry(entry)) {
    throw new TypeError('entry is not an entry ' + entry);
  }

  return new Promise(executor.bind(this, entry, validate));
}

function executor(entry, validate, resolve, reject) {
  if (validate && !is_valid_entry(entry)) {
    throw new TypeError('invalid entry ' + entry);
  }

  const is_create = !is_valid_entry_id(entry.id);
  let storable_entry;

  if (is_create) {
    const sanitized_entry = sanitize_entry(entry);
    storable_entry = filter_empty_properties(sanitized_entry);

    storable_entry.readState = ENTRY_STATE_UNREAD;
    storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
    storable_entry.dateCreated = new Date();
    delete storable_entry.dateUpdated;
  } else {
    storable_entry = entry;
  }

  const txn = this.conn.transaction('entry', 'readwrite');
  txn.oncomplete =
      txn_oncomplete.bind(this, storable_entry, is_create, resolve);
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const request = store.put(storable_entry);
  if (is_create) {
    request.onsuccess = event => storable_entry.id = event.target.result;
  }
}

function txn_oncomplete(entry, is_create, callback, event) {
  this.channel.postMessage(
      {type: 'entry-write', id: entry.id, 'create': is_create});

  const msg = is_create ? '%s: wrote new entry %d' : '%s: overwrote entry %d';
  this.console.debug(msg, write_entry.name, entry.id);

  callback(entry);
}
