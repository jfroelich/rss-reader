import assert from "/src/assert/assert.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// Load all feeds from the database
// Returns a promise that resolves to an array of feed objects
export default function getFeedsFromDb(conn) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
