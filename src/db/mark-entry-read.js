import assert from '/src/assert/assert.js';
import * as entry_utils from './entry-utils.js';
import * as types from './types.js';

export async function mark_entry_read(session, entry_id) {
  assert(entry_utils.is_valid_entry_id(entry_id));
  await mark_entry_read_internal(session.conn, entry_id);

  if (session.channel) {
    const message = {type: 'entry-read', id: entry_id};
    session.channel.postMessage(message);
  }
}

function mark_entry_read_internal(conn, entry_id) {
  return new Promise(mark_entry_read_executor.bind(null, conn, entry_id));
}

function mark_entry_read_executor(conn, entry_id, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;

  const store = txn.objectStore('entry');
  const request = store.get(entry_id);

  // TODO: move function definition to top level
  request.onsuccess = _ => {
    const entry = request.result;

    if (!types.is_entry(entry)) {
      reject(new Error('Loaded object is not an entry ' + entry_id));
      return;
    }

    if (entry.archiveState === entry_utils.ENTRY_STATE_ARCHIVED) {
      reject(new Error('Cannot mark archived entry as read ' + entry_id));
      return;
    }

    if (entry.readState === entry_utils.ENTRY_STATE_READ) {
      reject(new Error('Cannot mark read entry as read ' + entry_id));
      return;
    }

    entry.readState = entry_utils.ENTRY_STATE_READ;
    const currentDate = new Date();
    entry.dateUpdated = currentDate;
    entry.dateRead = currentDate;

    request.source.put(entry);
  };
}
