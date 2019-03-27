import Connection from '/src/db/connection.js';
import assert from '/src/lib/assert.js';

export default function get_feed_ids(conn) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);

    const txn = conn.conn.transaction('feeds');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('feeds');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
}
