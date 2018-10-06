import assert from '/src/assert/assert.js';
import * as entry_utils from './entry-utils.js';

export function get_entries(session, mode = 'all', offset, limit) {
  assert(is_valid_offset(offset));
  assert(is_valid_limit(limit));
  return get_entries_internal(session.conn, mode, offset, limit);
}

function is_valid_offset(offset) {
  return offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0);
}

function is_valid_limit(limit) {
  return limit === null || limit === undefined || limit === NaN ||
      (Number.isInteger(limit) && limit >= 0);
}

function get_entries_internal(conn, mode, offset, limit) {
  return new Promise(
      get_entries_executor.bind(null, conn, mode, offset, limit));
}

function get_entries_executor(conn, mode, offset, limit, resolve, reject) {
  const entries = [];
  let advanced = false;

  const txn = conn.transaction('entry');
  txn.oncomplete = _ => resolve(entries);
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');

  let request;
  if (mode === 'viewable') {
    const index = store.index('archiveState-readState');
    const path =
        [entry_utils.ENTRY_STATE_UNARCHIVED, entry_utils.ENTRY_STATE_UNREAD];
    request = index.openCursor(path);
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

    if (offset && !advanced) {
      advanced = true;
      cursor.advance(offset);
      return;
    }

    entries.push(cursor.value);

    if (limit > 0 && entries.length >= limit) {
      return;
    }

    cursor.continue();
  };
}
