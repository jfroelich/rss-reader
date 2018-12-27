import assert from '/src/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';

export async function delete_entry(session, id, reason) {
  assert(entry_utils.is_valid_entry_id(id));

  await new Promise((resolve, reject) => {
    const txn = session.conn.transaction('entry', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').delete(id);
  });

  if (session.channel) {
    const message = {type: 'entry-deleted', id: id, reason: reason};
    session.channel.postMessage(message);
  }
}
