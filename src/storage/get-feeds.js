import assert from "/src/assert.js";
import {isOpen} from "/src/storage/rdb.js";

// Load all feeds from the database
// Returns a promise that resolves to an array of feed objects
export default function getFeedsFromDb(conn) {
  assert(isOpen(conn));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
