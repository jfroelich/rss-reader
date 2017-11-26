import assert from "/src/assert.js";
import {isValidId as isValidFeedId} from "/src/storage/feed.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// Returns a promise that resolves to an array of entry ids that are associated with the given
// feed id. Throws an unchecked error if the connection is invalid or not open, or if the feed id
// is invalid. Throws a checked error if a database error occurs.
// @param conn {IDBDatabase} an open database connection
// @param id {Number} the id of a feed in the database
// @return {Promise}
export default function main(conn, id) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isValidFeedId(id));

    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
