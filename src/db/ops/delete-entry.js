import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import * as identifiable from '/src/db/identifiable.js';
import assert from '/src/lib/assert.js';

export default function delete_entry(conn, id) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(identifiable.is_valid_id(id));
    const txn = conn.conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      if (conn.channel) {
        conn.channel.postMessage({type: 'entry-deleted', id: id});
      }

      resolve();
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').delete(id);
  });
}
