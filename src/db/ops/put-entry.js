import Connection from '/src/db/connection.js';
import * as identifiable from '/src/db/identifiable.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import validate_entry from '/src/db/ops/validate-entry.js';
import {is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// Overwrite the corresponding entry object in the object store.
export default function put_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(is_entry(entry));
    assert(identifiable.is_valid_id(entry.id));

    normalize_entry(entry);
    sanitize_entry(entry);
    filter_empty_properties(entry);
    validate_entry(entry);

    entry.updated_date = new Date();

    const txn = conn.conn.transaction('entries', 'readwrite');
    txn.oncomplete = event => {
      if (conn.channel) {
        conn.channel.postMessage({type: 'entry-updated', id: entry.id});
      }

      resolve(entry);
    };
    txn.onerror = event => reject(event.target.error);

    txn.objectStore('entries').put(entry);
  });
}
