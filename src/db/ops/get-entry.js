import Connection from '/src/db/connection.js';
import is_valid_id from '/src/db/is-valid-id.js';
import assert from '/src/lib/assert.js';

export default function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(mode !== 'id' || is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.conn.transaction('entries');
    txn.onerror = event => reject(event.target.error);

    const store = txn.objectStore('entries');
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
        if (is_valid_id(entry_id)) {
          entry = {};
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}
