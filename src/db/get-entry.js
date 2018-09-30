import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';

export function get_entry(session, mode = 'id', value, key_only) {
  assert(mode !== 'id' || entry_utils.is_valid_entry_id(value));
  assert(mode !== 'id' || !key_only);
  return get_entry_internal(session.conn, mode, value, key_only);
}

function get_entry_internal(conn, mode, value, key_only) {
  return new Promise(
      get_entry_executor.bind(null, conn, mode, value, key_only));
}

function get_entry_executor(conn, mode, value, key_only, resolve, reject) {
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
      if (entry_utils.is_valid_entry_id(entry_id)) {
        entry = entry_utils.create_entry_object();
        entry.id = entry_id;
      }
    } else {
      entry = request.result;
    }

    resolve(entry);
  };
}
