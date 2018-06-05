import {ENTRY_STATE_UNREAD} from '/src/entry.js';

// TODO: drop the db prefix, the name is a concern of an importing module and
// not a concern of the exporting module, and the prefix is an overqualification

// Counts the number of entries in the entries object store. If mode is
// 'unread', then this is a count of unread entries only.
// @param conn {IDBDatabase} an open connection to the app's feed database
// @param mode {String} optional, defaults to 'all', if 'unread' then only
// unread entries are counted
// @throws {DOMException} when a database error occurs
// @return {Promise} returns a promise that resolves to a number of entries
export function db_count_entries(conn, mode = 'all') {
  return new Promise(executor.bind(null, conn, mode));
}

function executor(conn, mode, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');

  let request;
  if (mode === 'unread') {
    const index = store.index('readState');
    request = index.count(ENTRY_STATE_UNREAD);
  } else {
    request = store.count();
  }

  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
