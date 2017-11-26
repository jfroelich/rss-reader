import assert from "/src/assert.js";
import {isOpen} from "/src/storage/rdb.js";
import {isValidURLString} from "/src/url/url-string.js";

// Returns feed id if a feed with the given url exists in the database
// @param conn {IDBDatabase}
// @param url {String}
// @return {Promise}
export default function main(conn, urlString) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isValidURLString(urlString));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
