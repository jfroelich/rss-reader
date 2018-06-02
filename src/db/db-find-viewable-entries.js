import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

// TODO: make a helper for request_onsuccess
// TODO: merge into something like db-read-entries that accepts a query of some
// sort like {criteria-category: viewable}.

export function db_find_viewable_entries(conn, offset, limit) {
  return new Promise(executor.bind(null, conn, offset, limit));
}

function executor(conn, offset, limit, resolve, reject) {
  assert(is_valid_offset(offset));

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

function is_valid_offset(offset) {
  return offset === null || typeof offset === 'undefined' ||
      (Number.isInteger(offset) && offset >= 0);
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
