import {assert} from '/src/assert.js';
import {Entry, is_entry} from '/src/db/types/entry.js';
import filter_empty_properties from '/src/db/utils/filter-empty-properties.js';

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
