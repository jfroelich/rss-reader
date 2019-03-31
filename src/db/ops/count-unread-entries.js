import Connection from '/src/db/connection.js';
import assert from '/src/lib/assert.js';

export default function count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);

    const txn = conn.conn.transaction('entries');
    const store = txn.objectStore('entries');
    const index = store.index('read_state');
    const request = index.count(0);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
