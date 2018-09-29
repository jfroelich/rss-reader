import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

// TODO: is this even in use? doesn't seem like it. why did I implement?

export async function update_entry(session, entry) {
  assert(types.is_entry(entry));
  assert(entry_utils.is_valid_entry_id(entry.id));

  // TODO: should this be asserting entry.urls similar to update_feed?
  entry.dateUpdated = new Date();
  object.filter_empty_properties(entry);

  const put_bound = put_entry.bind(undefined, session.conn, entry);
  const promise = new Promise(put_bound);
  await promise;

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
