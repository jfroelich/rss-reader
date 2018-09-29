import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';

// TODO: is this even in use?

export async function delete_entry(conn, channel, id, reason) {
  assert(entry_utils.is_valid_entry_id(id));
  await delete_entry_internal(conn, id);

  if (channel) {
    channel.postMessage({type: 'entry-deleted', id: id, reason: reason});
  }
}

function delete_entry_internal(conn, entry_id) {
  return new Promise(delete_entry_executor.bind(null, conn, entry_id));
}

function delete_entry_executor(conn, entry_id, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  txn.objectStore('entry').delete(entry_id);
}
