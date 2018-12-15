import assert from '/src/assert.js';
import * as object from '/src/base/object-utils.js';

import * as entry_utils from './entry-utils.js';
import * as types from './types.js';

export async function create_entry(session, entry) {
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

  // All entries need to appear in the datePublished index, so all entries
  // must have a datePublished. If it is unknown, then default to dateCreated.
  if (entry.datePublished === undefined) {
    entry.datePublished = entry.dateCreated;
  }

  // Make sure dateUpdated is not set.
  delete entry.dateUpdated;

  object.filter_empty_properties(entry);

  const put_bound = put_entry.bind(null, session.conn, entry);
  const create_entry_promise = new Promise(put_bound);
  const id = await create_entry_promise;

  if (session.channel) {
    const message = {type: 'entry-created', id: id};
    session.channel.postMessage(message);
  }

  return id;
}

// Put an entry in the entry object store. This does not resolve until the
// transaction itself resolves. Resolving when the request resolves would be
// premature.
function put_entry(conn, entry, resolve, reject) {
  let id;
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = _ => resolve(id);
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');
  const request = store.put(entry);
  request.onsuccess = _ => id = request.result;
}
