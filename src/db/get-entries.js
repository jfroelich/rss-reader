import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

export function get_entries(conn, mode = 'all', offset = 0, limit = 0) {
  return new Promise((resolve, reject) => {
    assert(
        offset === null || typeof offset === 'undefined' ||
        (Number.isInteger(offset) && offset >= 0));
    assert(
        limit === null || typeof limit === 'undefined' ||
        (Number.isInteger(limit) && limit >= 0));

    const entries = [];
    let advanced = false;

    const txn = conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archiveState-readState');
      const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
      request = index.openCursor(key_path);
    } else if (mode === 'all') {
      request = store.openCursor();
    } else {
      throw new TypeError('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      // If an offset was specified and we did not yet advance, then seek
      // forward. Ignore the value at the current position.
      if (offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
        return;
      }

      entries.push(cursor.value);

      // Stop if limit defined and reached or surpassed limit
      if (limit > 0 && entries.length >= limit) {
        return;
      }

      cursor.continue();
    };
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
