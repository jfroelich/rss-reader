import assert from "/src/assert.js";
import * as Entry from "/src/reader-db/entry.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

// @param conn {IDBDatabase} an open connection to the reader database
// @param ids {Array} an array of entry ids
export default function removeEntriesFromDb(conn, ids) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(Array.isArray(ids));

    for(const id of ids) {
      assert(Entry.isValidId(id));
    }


    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(const id of ids) {
      store.delete(id);
    }
  });
}
