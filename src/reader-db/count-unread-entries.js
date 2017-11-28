import assert from "/src/assert/assert.js";
import {STATE_UNREAD} from "/src/reader-db/entry.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// Returns a promise that resolves to a count of unread entries in the database
// Throws an unchecked error if the database is closed or invalid.
// Throws a checked error if a database error occurs.
//
// @param conn {IDBDatabase} an open database connection
// @return {Promise}
export default function main(conn) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
