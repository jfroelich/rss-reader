import {create_entry, is_valid_entry_id} from '/src/entry.js';

// Find an entry in the database by mode id or mode url. If key only true then
// only basic entry loaded.
export function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || is_valid_entry_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('entry');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'url') {
      const index = store.index('urls');
      const href = value.href;
      request = key_only ? index.getKey(href) : index.get(href);
    } else if (mode === 'id') {
      request = store.get(value);
    } else {
      throw new TypeError('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      let entry;
      if (key_only) {
        const entry_id = request.result;
        if (is_valid_entry_id(entry_id)) {
          entry = create_entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
