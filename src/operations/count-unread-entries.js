import {ENTRY_STATE_UNREAD} from '/src/objects/entry.js';

// Return the number of unread entries in the database
// @param conn {IDBDatabase} an open database connection, required
// @return {Promise} a promise that resolves to the number of unread entries, or
// rejects with a database error
export function count_unread_entries(conn) {
  return new Promise(executor.bind(null, conn));
}

function executor(conn, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}