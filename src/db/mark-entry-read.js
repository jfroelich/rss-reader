import assert from '/src/assert/assert.js';

import * as entry_utils from './entry-utils.js';
import * as errors from './errors.js';
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

  if (!entry) {
    const message = 'No entry found with id ' + id;
    const error = new errors.NotFoundError(message);
    reject(error);
    return;
  }

  if (!types.is_entry(entry)) {
    const message = 'Read object is not an entry ' + id;
    const error = new TypeError(message);
    reject(error);
    return;
  }

  if (entry.archiveState === entry_utils.ENTRY_STATE_ARCHIVED) {
    const message = 'Cannot mark archived entry as read ' + id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  if (entry.readState === entry_utils.ENTRY_STATE_READ) {
    const message = 'Cannot mark read entry as read ' + id;
    const error = new errors.InvalidStateError(message);
    reject(error);
    return;
  }

  entry.readState = entry_utils.ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateUpdated = currentDate;
  entry.dateRead = currentDate;

  const entry_store = event.target.source;
  entry_store.put(entry);
}
