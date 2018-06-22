import {assert} from '/src/assert/assert.js';
import * as Entry from '/src/data-layer/entry.js';

export function iterate_entries(conn, mode = 'all', writable, handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');

    const txn_mode = writable ? 'readwrite' : 'readonly';
    const txn = conn.transaction('entry', txn_mode);
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'archive') {
      const index = store.index('archiveState-readState');
      const key_path = [Entry.ENTRY_STATE_UNARCHIVED, Entry.ENTRY_STATE_READ];
      request = index.openCursor(key_path);
    } else if (mode === 'all') {
      request = store.openCursor();
    } else {
      throw new Error('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      handle_entry(cursor);
      cursor.continue();
    };
  });
}
