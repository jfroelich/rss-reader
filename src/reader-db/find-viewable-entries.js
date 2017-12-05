import assert from "/src/assert/assert.js";
import {STATE_UNARCHIVED, STATE_UNREAD} from "/src/reader-db/entry.js";
import {isOpen} from "/src/indexeddb/utils.js";

// Loads entries from the database that are for viewing
// Specifically these are entries that are unread, and not archived

// TODO: look into using getAll again

export default function main(conn, offset, limit) {
  return new Promise(function executor(resolve, reject) {
    assert(isOpen(conn));

    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = function txOnComplete(event) {
      resolve(entries);
    };
    tx.onerror = function txOnError(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [STATE_UNARCHIVED, STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function requestOnsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(limited && ++counter < limit) {
            cursor.continue();
          }
        }
      }
    };
  });
}
