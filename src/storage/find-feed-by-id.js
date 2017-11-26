import assert from "/src/assert.js";
import {isValidId as isValidFeedId} from "/src/storage/feed.js";
import {isOpen} from "/src/utils/idb.js";

// Searches the feed store in the database for a feed corresponding to the given id. Returns a
// promise that resolves to the matching feed. Returns a promise that resolves to undefined if
// no matching feed is found. Throws an unchecked error if the database is closed or the id is
// not a valid feed id. Throws a checked error if there is a problem with the database.
//
// @param conn {IDBDatabase} an open database connection
// @param id {Number} a feed id
// @return {Promise}
export default function main(conn, id) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isValidFeedId(id));

    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
