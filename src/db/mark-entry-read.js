import {refresh_badge} from '/src/badge.js';
import {ENTRY_STATE_READ, ENTRY_STATE_UNREAD, is_entry, is_valid_entry_id} from '/src/entry.js';

// Marks an entry as read in the database.
export function mark_entry_read(conn, channel, entry_id) {
  return new Promise((resolve, reject) => {
    if (!is_valid_entry_id(entry_id)) {
      throw new TypeError('Invalid entry id ' + entry_id);
    }

    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'entry-marked-read', id: entry_id});
      refresh_badge(conn).catch(console.error);  // non-blocking
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = _ => {
      const entry = request.result;
      if (!entry) {
        console.error('No entry found', entry_id);
        return;
      }

      if (!is_entry(entry)) {
        console.error('Invalid data type', entry);
        return;
      }

      if (entry.readState === ENTRY_STATE_READ) {
        console.error('Invalid state for entry', entry_id);
        return;
      }

      if (entry.readState !== ENTRY_STATE_UNREAD) {
        console.error('Invalid state for entry', entry_id);
        return;
      }

      entry.readState = ENTRY_STATE_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;

      request.source.put(entry);
    };
  });
}
