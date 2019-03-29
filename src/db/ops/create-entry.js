import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import {is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function create_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(is_entry(entry));
    assert(entry.id === undefined);

    if (entry.read_state === undefined) {
      entry.read_state = Entry.UNREAD;
    }

    if (entry.archive_state === undefined) {
      entry.archive_state = Entry.UNARCHIVED;
    }

    if (entry.created_date === undefined) {
      entry.created_date = new Date();
    }

    // All entries need a value for published_date in order to appear in the
    // published_date index
    if (entry.published_date === undefined) {
      entry.published_date = entry.created_date;
    }

    delete entry.updated_date;
    normalize_entry(entry);
    sanitize_entry(entry);
    filter_empty_properties(entry);

    let id;
    const txn = conn.conn.transaction('entries', 'readwrite');
    txn.oncomplete = _ => {
      if (conn.channel) {
        conn.channel.postMessage({type: 'entry-created', id: id});
      }

      resolve(id);
    };
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = store.put(entry);
    request.onsuccess = _ => id = request.result;
  });
}
