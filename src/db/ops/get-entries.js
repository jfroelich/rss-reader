import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import assert from '/src/lib/assert.js';

export default function get_entries(conn, mode = 'all', offset, limit) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);

    assert(is_valid_offset(offset));
    assert(is_valid_limit(limit));
    const entries = [];
    let advanced = false;

    const txn = conn.conn.transaction('entries');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archive_state-read_state');
      const path = [Entry.UNARCHIVED, Entry.UNREAD];
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
  });
}

function is_valid_offset(offset) {
  return offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0);
}

function is_valid_limit(limit) {
  return limit === null || limit === undefined || limit === NaN ||
      (Number.isInteger(limit) && limit >= 0);
}
