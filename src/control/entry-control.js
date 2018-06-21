import * as Entry from '/src/model/entry.js';

// Deletes an entry from the database. Unlike delete_feed this does not expose
// feed id in its message because it would require an extra lookup.
export function delete_entry(conn, channel, id, reason) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_entry_id(id));  // prevent fake noops
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const msg = {type: 'entry-deleted', id: id, reason: reason};
      channel.postMessage(msg);
      resolve();
    };
    txn.onerror = _ => reject(txn.error);
    txn.objectStore('entry').delete(id);
  });
}
