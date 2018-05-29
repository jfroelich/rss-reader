import {ENTRY_STATE_UNREAD} from '/src/entry.js';

// Counts the number of unread entries in the entries object store
// @param conn {IDBDatabase} an open connection to the app's feed database
// @throws {DOMException} when a database error occurs
// @return {Promise} returns a promise that resolves to a count of unread
// entries in the entry object store
export function db_count_unread_entries(conn) {
  return new Promise(count_executor.bind(null, conn));
}

function count_executor(conn, resolve, reject) {
  // Counting unread entries is presumed to be a frequently performed operation,
  // so it is sensible to incur the storage cost of an index.

  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
