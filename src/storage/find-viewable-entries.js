import assert from "/src/assert.js";
import * as Entry from "/src/storage/entry.js";
import {isOpen} from "/src/storage/rdb.js";

// TODO: look into using getAll again

export default function findViewableEntries(conn, offset, limit) {
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
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_UNREAD];
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
