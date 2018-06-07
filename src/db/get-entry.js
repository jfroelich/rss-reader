import {create_entry, is_valid_entry_id} from '/src/entry.js';

// Asynchronously finds an entry in the database
// @param conn {IDBDatabase} an open database connection
// @param mode {String} the type of query, if mode is undefined then it is query
// by id, modes are 'url', 'id', lowercase only
// @param value {any} the value of the key to look for
// @option key_only {Boolean} if true then only the matching key is loaded
// @return {Promise} resolve to the matching entry or undefined
export function get_entry(conn, mode, value, key_only) {
  return new Promise(executor.bind(null, conn, mode, value, key_only));
}

function executor(conn, mode, value, key_only, resolve, reject) {
  assert(['id', 'url'].includes(mode));
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
  } else {
    request = store.get(value);
  }

  request.onsuccess = request_onsuccess.bind(request, key_only, resolve);
}

function request_onsuccess(key_only, callback, event) {
  let entry;
  if (key_only) {
    const entry_id = event.target.result;
    if (is_valid_entry_id(entry_id)) {
      entry = create_entry();
      entry.id = entry_id;
    }
  } else {
    entry = event.target.result;
  }

  callback(entry);
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'Assertion error');
}
