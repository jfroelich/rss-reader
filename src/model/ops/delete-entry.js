import {assert} from '/src/assert.js';
import {Entry} from '/src/model/types/entry.js';

export default function delete_entry(conn, id) {
  return new Promise((resolve, reject) => {
    assert(Entry.isValidId(id));
    const txn = conn.conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      conn.channel.postMessage({type: 'entry-deleted', id: id});
      resolve();
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').delete(id);
  });
}
