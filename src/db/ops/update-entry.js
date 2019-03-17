import {Entry, is_entry} from '/src/db/object/entry.js';
import assert from '/src/lib/assert.js';
import filter_empty_properties from '/src/lib/filter-empty-properties.js';

export default function update_entry(conn, channel, entry) {
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(Entry.isValidId(entry.id));
    // Entries are not required to have urls in the model layer.

    entry.dateUpdated = new Date();
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
