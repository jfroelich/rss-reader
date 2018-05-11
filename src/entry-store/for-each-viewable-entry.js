// TODO: break apart again into function-per-file

import {ENTRY_STATE_READ, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD, is_entry, is_valid_entry, is_valid_entry_id, sanitize_entry} from '/src/entry-store/entry.js';
import {is_valid_feed_id} from '/src/feed-store/feed.js';
import {filter_empty_properties} from '/src/lib/object.js';
// TODO: avoid circular dependency
import {refresh_badge} from '/src/refresh-badge.js';

// TODO: use context
export function for_each_viewable_entry(conn, offset, limit, callback) {
  return new Promise(for_each_viewable_entry_executor.bind(
      null, conn, offset, limit, callback));
}

function for_each_viewable_entry_executor(
    conn, offset, limit, callback, resolve, reject) {
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
