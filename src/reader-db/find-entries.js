import assert from "/src/assert/assert.js";
import {isOpen} from "/src/indexeddb/utils.js";
import isPosInt from "/src/utils/is-pos-int.js";

// Scans the entry object store for entries matching the predicate
// @param conn {IDBDatabase}
// @param predicate {Function} evaluated against each entry during scan,
// an entry is included in the output if true
// @param limit {Number} optional, if specified then must be an integer > 0,
// an upper bound on number of entries included in output
// @return {Promise} resolves to an array of entry objects, or rejects with
// a database-related error.
export default function main(conn, predicate, limit) {
  return new Promise(function executor(resolve, reject) {

    assert(isOpen(conn));
    assert(typeof predicate === 'function');
    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(isPosInt(limit));
      assert(limit > 0);
    }

    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = function(event) {
      reject(tx.error);
    };
    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const request = store.openCursor();
    request.onsuccess = function requestOnsuccess(event) {
      const cursor = event.target.result;
      if(!cursor) {
        // Either no entries, or iterated all. Do not advance. Allow the
        // transaction to settle which allows the promise to settle.
        return;
      }

      const entry = cursor.value;
      if(predicate(entry)) {
        entries.push(entry);
        if(limited && entries.length === limit) {
          // Do not advance. Allow the transaction to settle which allows
          // the promise to settle.
          return;
        }
      }

      cursor.continue();
    };
  });
}
