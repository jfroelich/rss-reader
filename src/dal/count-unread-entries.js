import * as Entry from '/src/data-layer/entry.js';

export function count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
