import assert from "/src/assert/assert.js";
import {isEntry} from "/src/reader-db/entry.js";
import {isOpen} from "/src/indexeddb/utils.js";

export default function putEntryInDb(conn, entry) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(isEntry(entry));
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
