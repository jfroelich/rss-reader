import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

// Asynchronously loads entries from the database into an array of entry objects
// @param conn {IDBDatabase} an open database connection
// @param mode {String} defaults to 'all', supports 'viewable', which entries
// are loaded
// @param offset {Number} optional, how many entries to skip past from the start
// @param limit {Number} optional, upper bound on number of entries to load
// @error {Error} invalid inputs
// @error {DOMException} database error
// @return {Promise} resolves to an array of entry objects
export async function db_get_entries(
    conn, mode = 'all', offset = 0, limit = -1) {
  return new Promise(
      db_get_entries_executor.bind(null, conn, mode, offset, limit));
}

function db_get_entries_executor(conn, mode, offset, limit, resolve, reject) {
  assert(mode && typeof mode === 'string');
  assert(is_valid_offset(offset));
  assert(is_valid_limit(limit));

  const shared_state =
      {entries: [], advanced: false, limit: limit, offset: offset};

  const txn = conn.transaction('entry');
  txn.oncomplete = _ => resolve(shared_state.entries);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');

  let request;
  if (mode === 'viewable') {
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    request = index.openCursor(key_path);
  } else if (mode === 'all') {
    request = store.openCursor();
  } else {
    throw new TypeError('Invalid mode ' + mode);
  }

  request.onsuccess = request_onsuccess.bind(request, shared_state);
}

function request_onsuccess(state, event) {
  const cursor = event.target.result;
  if (!cursor) {
    // Either no entries found, or all entries iterated
    return;
  }

  // If an offset was specified and we did not yet advance, then seek forward.
  // Ignore the value at the current position.
  if (state.offset && !state.advanced) {
    state.advanced = true;
    cursor.advance(state.offset);
    return;
  }

  state.entries.push(cursor.value);

  // If limit specified, then only advance if under limit
  if (state.limit > 0 && state.entries.length < state.limit) {
    cursor.continue();
    return;
  }

  cursor.continue();
}

function is_valid_limit(limit) {
  return limit === null || typeof limit === 'undefined' ||
      Number.isInteger(limit);
}

function is_valid_offset(offset) {
  return offset === null || typeof offset === 'undefined' ||
      (Number.isInteger(offset) && offset >= 0);
}

function assert(value) {
  if (!value) throw new Error('Assertion error');
}
