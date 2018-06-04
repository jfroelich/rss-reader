import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

export async function db_get_entries(conn, options = {}) {
  return new Promise(db_get_entries_executor.bind(null, conn, options));
}

function db_get_entries_executor(conn, options, resolve, reject) {
  assert(is_valid_offset(options.offset));
  assert(is_valid_limit(options.limit));

  const shared_state = {
    entries: [],
    advanced: false,
    limit: options.limit,
    offset: options.offset
  };

  const txn = conn.transaction('entry');
  txn.oncomplete = _ => resolve(shared_state.entries);
  txn.onerror = _ => reject(txn.error);
  const store = txn.objectStore('entry');

  let request;
  if (options.mode === 'viewable') {
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    request = index.openCursor(key_path);
  } else {
    request = store.openCursor();
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
