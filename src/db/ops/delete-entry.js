import Connection from '/src/db/connection.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';

export default function delete_entry(conn, id) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(resource_utils.is_valid_id(id));
    const txn = conn.conn.transaction('entries', 'readwrite');
    txn.oncomplete = event => {
      if (conn.channel) {
        conn.channel.postMessage({type: 'entry-deleted', id: id});
      }

      resolve();
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entries').delete(id);
  });
}
