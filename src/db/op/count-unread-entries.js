import * as entry_utils from '/src/db/entry-utils.js';

export function count_unread_entries(conn) {
  return new Promise(count_unread_entries_executor.bind(null, conn));
}

function count_unread_entries_executor(conn, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(entry_utils.ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
