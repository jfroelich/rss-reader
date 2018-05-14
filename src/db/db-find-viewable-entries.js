import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

// TODO: use context?
export function db_find_viewable_entries(conn, offset, limit) {
  if (offset !== null && typeof offset !== 'undefined') {
    assert(Number.isInteger(offset) && offset >= 0);
  }

  return new Promise(
      find_viewable_entries_executor.bind(null, conn, offset, limit));
}

function find_viewable_entries_executor(conn, offset, limit, resolve, reject) {
  const entries = [];
  let counter = 0;
  let advanced = false;
  const limited = limit > 0;
  const txn = conn.transaction('entry');
  txn.oncomplete = _ => resolve(entries);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
  const request = index.openCursor(key_path);
  request.onsuccess = _ => {
    const cursor = request.result;
    if (cursor) {
      if (offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
      } else {
        entries.push(cursor.value);
        if (limited && ++counter < limit) {
          cursor.continue();
        }
      }
    }
  };
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
