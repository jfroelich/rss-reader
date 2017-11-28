import assert from "/src/assert/assert.js";
import * as Entry from "/src/reader-db/entry.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";
import isPosInt from "/src/utils/is-pos-int.js";

// Loads archivable entries from the database. An entry is archivable if it has not already been
// archived, and has been read, and matches the custom predicate function.

// This does two layers of filtering. It would preferably be one layer but a three property index
// involving a date gets complicated. Given the perf is not top priority this is acceptable for
// now. The first filter layer is at the indexedDB level, and the second is the in memory
// predicate. The first layer reduces the number of entries loaded by a large amount.

// TODO: rather than assert failure when limit is 0, resolve immediately with an empty array.
// Limit is optional

// TODO: I feel like there is not a need for the predicate function. This is pushing too much
// burden/responsibility to the caller. This should handle the expiration check that the caller
// is basically using the predicate for.


export default function main(conn, predicate, limit) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));
    assert(typeof predicate === 'function');

    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(isPosInt(limit), limit);
      assert(limit > 0);
    }

    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = () => reject(tx.error);

    // TODO: use arrow function? be consistent
    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;
      if(predicate(entry)) {
        entries.push(entry);
        // Stop walking if limited and reached limit
        if(limited && (entries.length >= limit)) {
          return;
        }
      }

      cursor.continue();
    };
  });
}
