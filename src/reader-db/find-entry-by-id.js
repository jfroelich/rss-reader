import assert from "/src/assert/assert.js";
import {isValidId as isValidEntryId} from "/src/reader-db/entry.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// Searches for and returns an entry object matching the id
// @param conn {IDBDatabase} an open database connection
// @param id {Number} id of entry to find
// @returns {Promise} a promise that resolves to an entry object, or undefined
// if no matching entry was found
export default function main(conn, id) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isValidEntryId(id));
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
