import {Entry} from '/src/model/types/entry.js';

export default function count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
