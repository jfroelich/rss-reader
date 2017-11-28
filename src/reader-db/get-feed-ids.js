import assert from "/src/assert/assert.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// Returns a promise that resolves to an array of feed ids, or rejects with a database error
// @param conn {IDBDatabase} an open database connection to the reader database
export default function main(conn) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
