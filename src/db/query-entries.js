import assert from '/src/base/assert.js';
import * as entry_utils from './entry-utils.js';

export function query_entries(session, query = {}) {
  assert(session);
  assert(session.conn);
  assert(typeof query === 'object');
  assert(is_valid_feed_id(query.feed_id));
  assert(is_valid_read_state(query.read_state));
  assert(is_valid_offset(query.offset));
  assert(is_valid_direction(query.direction));

  const bound = query_entries_executor.bind(null, session.conn, query);
  return new Promise(bound);
}

function is_valid_feed_id(id) {
  return id === undefined || (Number.isInteger(id) && id >= 0)
}

function query_entries_executor(conn, query, resolve, reject) {
  const offset = query.offset === undefined ? 0 : query.offset;
  const limit = query.limit === undefined ? 0 : query.limit;
  const direction = translate_direction(query.direction);
  const entries = [];

  const txn = conn.transaction('entry');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');
  const request = build_request(store, query, direction);

  // Setup a shared state across all cursor event handlers
  const cursor_state = {};
  cursor_state.advanced = offset ? false : true;
  cursor_state.offset = offset;
  cursor_state.limit = limit;
  cursor_state.entries = entries;
  cursor_state.callback = resolve;

  request.onsuccess = request_onsuccess.bind(request, cursor_state);
}

function is_valid_direction(dir) {
  return dir === undefined || dir === 'ASC' || dir === 'DESC';
}

// Translate the query parameter direction into the indexedDB cursor direction
function translate_direction(direction) {
  // Assume that by this point the input direction is valid so there is no
  // need for a sanity check. The absence of a precondition assertion also seems
  // reasonable because this is an internal function and not part of the public
  // API, so it is free to enjoy caller guarantees.

  // There is no need to translate in the default case of iterating forward. So
  // we leave the output direction as undefined in that case, which will have
  // the effect of specifying undefined to openCursor later, which will then
  // default to forward. So we only need to have an explicit value in the
  // reverse case.
  return direction === 'DESC' ? 'prev' : undefined;
}

// Compose the proper IDBRequest object based on the query values
function build_request(store, query, direction) {
  let request;

  // Several branches use these same two variables
  const min_date = new Date(1);
  const max_date = new Date();

  // Shorter alias
  const read = entry_utils.ENTRY_STATE_READ;
  const unread = entry_utils.ENTRY_STATE_UNREAD;


  if (query.feed_id === 0 || query.feed_id === undefined) {
    if (query.read_state === undefined) {
      const index = store.index('datePublished');
      let range = undefined;
      request = index.openCursor(range, direction);
    } else if (query.read_state === unread) {
      const index = store.index('readState-datePublished');
      const lower_bound = [unread, min_date];
      const upper_bound = [unread, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    } else {
      const index = store.index('readState-datePublished');
      const lower_bound = [read, min_date];
      const upper_bound = [read, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    }
  } else {
    if (query.read_state === undefined) {
      const index = store.index('feed-datePublished');
      const lower_bound = [query.feed_id, min_date];
      const upper_bound = [query.feed_id, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    } else if (query.read_state === unread) {
      const index = store.index('feed-readState-datePublished');
      const lower_bound = [query.feed_id, unread, min_date];
      const upper_bound = [query.feed_id, unread, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    } else {
      const index = store.index('feed-readState-datePublished');
      const lower_bound = [query.feed_id, read, min_date];
      const upper_bound = [query.feed_id, read, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    }
  }

  return request;
}

function request_onsuccess(cursor_state, event) {
  const cursor = event.target.result;

  // This is one of two iteration stopping conditions. If there is no cursor, we
  // are done. We might not have encountered any entries at all, or we advanced
  // the cursor past the end.
  if (!cursor) {
    cursor_state.callback(cursor_state.entries);
    return;
  }

  // If we have not advanced and an offset was specified, then ignore the
  // current cursor value, and jump ahead to the offset.
  if (!cursor_state.advanced && cursor_state.offset > 0) {
    cursor_state.advanced = true;
    cursor.advance(cursor_state.offset);
    return;
  }

  cursor_state.entries.push(cursor.value);

  // If we are limited and reached the limit, then do not continue. This is also
  // a stopping condition. Technically the condition should just be === limit,
  // and using >= is a relaxed condition out of paranoia related to concurrency.
  if (cursor_state.limit > 0 &&
      cursor_state.entries.length >= cursor_state.limit) {
    cursor_state.callback(cursor_state.entries);
    return;
  }

  cursor.continue();
}

function is_valid_offset(offset) {
  return offset === undefined || (Number.isInteger(offset) && offset >= 0);
}

function is_valid_read_state(state) {
  return state === undefined || state === entry_utils.ENTRY_STATE_READ ||
      state === entry_utils.ENTRY_STATE_UNREAD
}
