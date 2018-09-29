import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as object from '/src/db/object-utils.js';
import * as types from '/src/db/types.js';

// TODO: is this even in use? doesn't seem like it. why did I implement?

export async function update_entry(conn, channel, entry) {
  assert(types.is_entry(entry));
  assert(entry_utils.is_valid_entry_id(entry.id));

  // TODO: should this be asserting entry.urls similar to update_feed?
  entry.dateUpdated = new Date();
  object.filter_empty_properties(entry);

  await update_entry_internal(conn, entry);

  if (channel) {
    channel.postMessage({type: 'entry-updated', id: entry.id});
  }
}

function update_entry_internal(conn, entry) {
  return new Promise(update_entry_executor.bind(null, conn, entry));
}

function update_entry_executor(conn, entry, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  txn.objectStore('entry').put(entry);
}
