import {Entry} from '/src/db/object/entry.js';
import assert from '/src/lib/assert.js';

export default function delete_entry(conn, channel, id) {
  return new Promise((resolve, reject) => {
    assert(Entry.isValidId(id));
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
