import * as entry_utils from '/src/db/entry-utils.js';

export function count_unread_entries(session) {
  return new Promise((resolve, reject) => {
    const txn = session.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(entry_utils.ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
