import Connection from '/src/db/connection.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import validate_entry from '/src/db/ops/validate-entry.js';
import * as resource_utils from '/src/db/resource-utils.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// Overwrite the corresponding entry object in the object store.
export default function put_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(entry && typeof entry === 'object');
    assert(resource_utils.is_valid_id(entry.id));

    resource_utils.normalize_resource(entry);
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
