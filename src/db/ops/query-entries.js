import Connection from '/src/db/connection.js';
import Entry from '/src/db/entry.js';
import Feed from '/src/db/feed.js';
import * as identifiable from '/src/db/identifiable.js';
import assert from '/src/lib/assert.js';

export default function query_entries(conn, query = {}) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof Connection);
    assert(typeof query === 'object');
    assert(
        query.feed_id === undefined || identifiable.is_valid_id(query.feed_id));
    assert(is_valid_read_state(query.read_state));
    assert(is_valid_offset(query.offset));
    assert(is_valid_direction(query.direction));

    const offset = query.offset === undefined ? 0 : query.offset;
    const limit = query.limit === undefined ? 0 : query.limit;
    const direction = translate_direction(query.direction);
    const entries = [];

    const txn = conn.conn.transaction('entries');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = build_request(store, query, direction);

    // TODO: now that request handler is nested, this cursor_state object
    // provides little benefit, remove it

    // Setup a shared state across all cursor event handlers
    const cursor_state = {};
    cursor_state.advanced = offset ? false : true;
    cursor_state.offset = offset;
    cursor_state.limit = limit;
    cursor_state.entries = entries;
    cursor_state.callback = resolve;

    request.onsuccess = function(event) {
      const cursor = event.target.result;

      // This is one of two iteration stopping conditions. If there is no
      // cursor, we are done. We might not have encountered any entries at
      // all, or we advanced the cursor past the end.
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

      // If we are limited and reached the limit, then do not continue. This
      // is also a stopping condition. Technically the condition should just
      // be === limit, and using >= is a relaxed condition out of paranoia
      // related to concurrency.
      if (cursor_state.limit > 0 &&
          cursor_state.entries.length >= cursor_state.limit) {
        cursor_state.callback(cursor_state.entries);
        return;
      }

      cursor.continue();
    };
  });
}

// Compose an IDBRequest object based on query values
function build_request(store, query, direction) {
  let request;
  // Several branches use these same two variables
  const min_date = new Date(1);
  const max_date = new Date();
  // Shorter alias
  const read = Entry.READ;
  const unread = Entry.UNREAD;

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

// Translate the query parameter direction into the indexedDB cursor direction
function translate_direction(direction) {
  return direction === 'DESC' ? 'prev' : undefined;
}

function is_valid_direction(dir) {
  return dir === undefined || dir === 'ASC' || dir === 'DESC';
}

function is_valid_read_state(state) {
  return state === undefined || state === Entry.READ || state === Entry.UNREAD;
}

function is_valid_offset(offset) {
  return offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0);
}
