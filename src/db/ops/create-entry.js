import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
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

    if (entry.date_created === undefined) {
      entry.date_created = new Date();
    }

    // All entries need to appear in the date_published index
    if (entry.date_published === undefined) {
      entry.date_published = entry.date_created;
    }

    delete entry.date_updated;
    normalize_entry(entry);
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
