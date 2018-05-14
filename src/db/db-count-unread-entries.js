import {ENTRY_STATE_UNREAD} from '/src/entry.js';

export function db_count_unread_entries(conn) {
  return new Promise(count_executor.bind(null, conn));
}

function count_executor(conn, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
