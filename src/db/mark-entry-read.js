import assert from '/src/assert/assert.js';
import * as entry_utils from './entry-utils.js';
import * as types from './types.js';

// TODO: revise update-entry in the style of update-feed, then change this
// function to simply wrap a call to update-entry, and then possibly just
// deprecate this function

export async function mark_entry_read(session, id) {
  assert(entry_utils.is_valid_entry_id(id));

  const partial_executor = executor.bind(null, session.conn, id);
  await new Promise(partial_executor);

  if (session.channel) {
    const message = {type: 'entry-read', id: id};
    session.channel.postMessage(message);
  }
}

function executor(conn, id, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;

  const store = txn.objectStore('entry');
  const request = store.get(id);
  request.onsuccess = request_onsuccess.bind(request, id);
}

function request_onsuccess(id, event) {
  const entry = event.target.result;

  // TODO: use specific error types from ./errors.js
  // TODO: be more verbose so this is simpler to read

  if (!entry) {
    reject(new Error('No entry found with id ' + id));
    return;
  }

  if (!types.is_entry(entry)) {
    reject(new Error('Loaded object is not an entry ' + id));
    return;
  }

  if (entry.archiveState === entry_utils.ENTRY_STATE_ARCHIVED) {
    reject(new Error('Cannot mark archived entry as read ' + id));
    return;
  }

  if (entry.readState === entry_utils.ENTRY_STATE_READ) {
    reject(new Error('Cannot mark read entry as read ' + id));
    return;
  }

  entry.readState = entry_utils.ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  event.target.source.put(entry);
}
