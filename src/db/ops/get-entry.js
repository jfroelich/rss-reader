import {assert} from '/src/assert.js';
import {Entry} from '/src/db/types/entry.js';

export default function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || Entry.isValidId(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('entry');
    txn.onerror = event => reject(event.target.error);

    const store = txn.objectStore('entry');
    let request;
    if (mode === 'url') {
      const index = store.index('urls');
      const href = value.href;
      request = key_only ? index.getKey(href) : index.get(href);
    } else if (mode === 'id') {
      request = store.get(value);
    } else {
      reject(new TypeError('Invalid mode ' + mode));
      return;
    }

    request.onsuccess = _ => {
      let entry;
      if (key_only) {
        const entry_id = request.result;
        if (Entry.isValidId(entry_id)) {
          entry = new Entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}