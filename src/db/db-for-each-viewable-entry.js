import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

/*

## db-for-each-viewable-entry
Opens a cursor over the entry store for viewable entries starting from the given
offset, and iterates up to the given limit, sequentially passing each
deserialized entry to the callback. Returns a promise that resolves once all
appropriate entries have been iterated. The promise rejects if an error occurs
in indexedDB.

### Parameters
* **conn** {IDBDatabase}
* **offset** {Number}
* **limit** {Number}
* **callback** {Function}

### TODOs
* create a `request_onsuccess` helper
* do I want a separate callback for on-all-iterated?
*/

// TODO: use context
export function db_for_each_viewable_entry(conn, offset, limit, callback) {
  return new Promise(executor.bind(null, conn, offset, limit, callback));
}

function executor(conn, offset, limit, callback, resolve, reject) {
  let counter = 0;
  let advanced = false;
  const limited = limit > 0;

  const txn = conn.transaction('entry');
  txn.oncomplete = resolve;
  txn.onerror = _ => reject(txn.error);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
  const request = index.openCursor(key_path);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if (cursor) {
      if (offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
      } else {
        // Put the request on the stack prior to the callback
        if (limited && ++counter < limit) {
          cursor.continue();
        }

        callback(cursor.value);
      }
    }
  };
}
