import assert from "/src/assert.js";
import {isValidURLString} from "/src/url/url-string.js";
import {isOpen} from "/src/utils/idb.js";

// TODO: this returns an id. It should be renamed appropriately.
// TODO: perhaps this should accept a URL instead of a url string, so that there is no ambiguity
// and there is no need to assert the url is valid, given that entry urls are always valid

// Returns an entry ID, not an entry, matching url
// @param conn {IDBDatabase}
// @param url {String}
export default function main(conn, urlString) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isValidURLString(urlString));

    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
