import * as identifiable from '/src/db/identifiable.js';
import Entry from '/src/db/entry.js';
import assert from '/src/lib/assert.js';

export default function delete_entry(conn, channel, id) {
  return new Promise((resolve, reject) => {
    assert(identifiable.is_valid_id(id));
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      if (channel) {
        channel.postMessage({type: 'entry-deleted', id: id});
      }

      resolve();
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').delete(id);
  });
}
