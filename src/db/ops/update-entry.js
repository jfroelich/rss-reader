import * as identifiable from '/src/db/identifiable.js';
import Entry from '/src/db/object/entry.js';
import normalize_entry from '/src/db/ops/normalize-entry.js';
import {is_entry} from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

// Overwrite the corresponding entry object in the object store.
export default function update_entry(conn, channel, entry) {
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(identifiable.is_valid_id(entry.id));
    // Entries are not required to have urls in the model layer, so there is no
    // assertion here on entry.urls

    entry.dateUpdated = new Date();

    // Even though it would be more performant to normalize earlier in the
    // data flow, here we must do it because it is a model constraint.
    normalize_entry(entry);

    filter_empty_properties(entry);

    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      if (channel) {
        channel.postMessage({
          type: 'entry-updated',
          id: entry.id,
          // NOTE: this does not indicate transition, just current state
          read: entry.readState === Entry.READ ? true : false
        });
      }

      resolve(entry);
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').put(entry);
  });
}
