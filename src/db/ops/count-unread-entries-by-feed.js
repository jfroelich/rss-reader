import Connection from '/src/db/connection.js';
import assert from '/src/lib/assert.js';

export default function count_unread_entries_by_feed(conn, id) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);

    const txn = conn.conn.transaction('entries');
    const store = txn.objectStore('entries');
    const index = store.index('feed-read_state');
    const range_only_value = [id, 0];
    const request = index.count(range_only_value);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
