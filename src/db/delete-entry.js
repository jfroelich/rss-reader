import assert from '/src/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';

export async function delete_entry(session, id, reason) {
  assert(entry_utils.is_valid_entry_id(id));
  await delete_entry_internal(session.conn, id);

  if (session.channel) {
    const message = {type: 'entry-deleted', id: id, reason: reason};
    session.channel.postMessage(message);
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
