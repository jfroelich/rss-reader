import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

export async function create_entry(conn, channel, entry) {
  assert(types.is_entry(entry));
  assert(entry.id === undefined);

  if (entry.readState === undefined) {
    entry.readState = entry_utils.ENTRY_STATE_UNREAD;
  }

  if (entry.archiveState === undefined) {
    entry.archiveState = entry_utils.ENTRY_STATE_UNARCHIVED;
  }

  if (entry.dateCreated === undefined) {
    entry.dateCreated = new Date();
  }

  delete entry.dateUpdated;
  object.filter_empty_properties(entry);

  const id = await create_entry_internal(conn, entry);

  if (channel) {
    channel.postMessage({type: 'entry-created', id: id});
  }
}

function create_entry_internal(conn, entry) {
  return new Promise(create_entry_executor.bind(null, conn, entry));
}

function create_entry_executor(conn, entry, resolve, reject) {
  let id;
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = _ => resolve(id);
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');
  const request = store.put(entry);
  request.onsuccess = _ => id = request.result;
}
