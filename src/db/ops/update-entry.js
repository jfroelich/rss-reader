import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import * as identifiable from '/src/db/identifiable.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
import sanitize_entry from '/src/db/ops/sanitize-entry.js';
import validate_entry from '/src/db/ops/validate-entry.js';
import {ENTRY_MAGIC, is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// TODO: once patch-entry is implemented, reimplement this as put-entry

// Overwrite the corresponding entry object in the object store.
export default function update_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    // Invariant
    // TODO: remove once patch-entry is implemented and tested
    const overwrite = true;

    assert(conn instanceof Connection);

    if (overwrite) {
      assert(is_entry(entry));
    } else {
      assert(typeof entry === 'object');
      assert(entry.magic === undefined || entry.magic === ENTRY_MAGIC)
    }

    assert(identifiable.is_valid_id(entry.id));

    if (overwrite) {
      normalize_entry(entry);
    } else {
      // do this to avoid triggering the sanity check at start of
      // normalize-entry
      // TODO: remove the sanity check and reenvision normalize entry as
      // something that looks at any kind of object
      entry.magic = ENTRY_MAGIC;
      normalize_entry(entry);
    }

    if (overwrite) {
      sanitize_entry(entry);
    } else {
      // sanitize later after mutating entry in place
    }


    entry.updated_date = new Date();

    // Even though it would be more performant to normalize earlier in the
    // data flow, here we must do it because it is a model constraint.

    sanitize_entry(entry);
    filter_empty_properties(entry);
    validate_entry(entry);

    const txn = conn.conn.transaction('entries', 'readwrite');
    txn.oncomplete = event => {
      if (conn.channel) {
        conn.channel.postMessage({
          type: 'entry-updated',
          id: entry.id,
          // NOTE: this does not indicate transition, just current state
          read: entry.read_state === Entry.READ ? true : false
        });
      }

      resolve(entry);
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entries').put(entry);
  });
}
