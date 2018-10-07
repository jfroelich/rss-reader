import assert from '/src/assert/assert.js';
import * as entry_utils from './entry-utils.js';
import * as object from './object-utils.js';
import * as types from './types.js';

// TODO: change mark-entry-read to use this, in the same manner that i did for
// how activate-feed uses update-feed. then use this base to also implement
// support for star/unstar of entries

export async function update_entry(session, entry) {
  assert(types.is_entry(entry));
  assert(entry_utils.is_valid_entry_id(entry.id));

  // We do not assert that the entry has a url. Entries are not required to have
  // urls at the model layer. Only higher layers are concerned with imposing
  // that constraint.

  entry.dateUpdated = new Date();
  object.filter_empty_properties(entry);

  await new Promise(put_entry.bind(undefined, session.conn, entry));

  if (session.channel) {
    const message = {type: 'entry-updated', id: entry.id};
    session.channel.postMessage(message);
  }
}

function put_entry(conn, entry, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  txn.objectStore('entry').put(entry);
}
