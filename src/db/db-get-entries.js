import {ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/entry.js';

// TODO: this is a placeholder. My goal is to unify all of the various queries
// that involve loading multiple entries.
// * Using CRUD and/or REST-API terminology, use method names like
// get-create-update-delete, and stop trying to use file metaphor of read/write.
// * load all into array up, give up on the cursor-callback approach.
// * as a halfway improvement, have a query-category parameter that represents
// which type of query should be performed
// * merge in one module at a time is the plan, going top down in folder
// alphabetical order
// * give up on using context

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

  // Based on the mode, fire off the proper openCursor request and start
  // iterating entries
  let request;
  if (options.mode === 'viewable') {
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    request = index.openCursor(key_path);
  } else {
    // Default to load all
    request = store.openCursor();
  }

  request.onsuccess = request_onsuccess.bind(request, shared_state);
}

function request_onsuccess(state, event) {
  const cursor = event.target.result;
  if (!cursor) {
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

  if (state.limit > 0) {
    // If limit specified, then only advance if under limit.
    if (state.entries.length < state.limit) {
      cursor.continue();
    }
  } else {
    // Always advance if unlimited
    cursor.continue();
  }
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
