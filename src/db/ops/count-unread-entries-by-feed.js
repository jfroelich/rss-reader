import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import assert from '/src/lib/assert.js';

export default function count_unread_entries_by_feed(conn, id) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);

    const txn = conn.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('feed-readState');
    const range_only_value = [id, Entry.UNREAD];
    const request = index.count(range_only_value);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
