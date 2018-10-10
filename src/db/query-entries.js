import assert from '/src/base/assert.js';
import * as entry_utils from './entry-utils.js';

// Returns an array of matching entries. This still returns an array even when
// no entries are found so the result is always defined. |query| is a required
// parameter that constrains which entries are loaded from the database and
// included in the output.
//
// Query properties:
// * feed_id - 0 for all feeds, or id of feed, required
// * sort_order ('asc' or 'dsc') on entry date
// * offset - how many objects to skip
// * limit - max number of objects to return
// * read_state - undefined for any state, or read or unread only state
// * _cursor_strategy - internal test property, do not use

// TODO: for sorting do I want date created or date published? is date published
// guaranteed? i think i want date published

// TODO: i have to use cursor. if i use getAll, then i would have to load all
// entries without any offset or limit, then sort all, then apply offset and
// limit. if i use a cursor, i can use cursor.advance to advance to offset, i
// can stop iterating at limit, and i can use the direction parameter to
// openCursor. getAll has no direction parameter. offset and limit only make
// sense based on direction. the count trick only works on natural order
// results.

// TODO: is using a cursor better performance than getAll?

export function query_entries(session, query) {
  assert(typeof query === 'object');
  assert(Number.isInteger(query.feed_id) && query.feed_id >= 0);
  assert(is_valid_read_state(query.read_state));
  assert(is_valid_offset(query.offset));

  const bound = query_entries_executor.bind(null, session.conn, query);
  return new Promise(bound);
}

function query_entries_executor(conn, query, resolve, reject) {
  const entries = [];

  const txn = conn.transaction('entry');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');

  // For purity, we store calculations in local variables instead of modifying
  // the input.
  const offset = query.offset === undefined ? 0 : query.offset;
  const limit = query.limit === undefined ? 0 : query.limit;

  // Any request will be using getAll. getAll's second parameter is count, where
  // we can specify limit. It is preferable to use this because this reduces the
  // amount of data loaded. However, getAll does not support offset, so we
  // cannot use the count parameter as intended. However, we can work around
  // this, by calculating limit relative to offset as (offset + limit), and then
  // later getting a slice of the array after offset. I hope the performance
  // will be reasonable.
  const count = offset + limit;


  // TODO: based on the query parameters, build the request. The request may
  // run on the store, or some index on the store.

  let request;

  if (query.feed_id === 0) {
    if (query.read_state === undefined) {
      // any feed, any read state
      // in this case we just want to open an unbounded cursor on the date
      // index, and then specify direction to openCursor accordingly

    } else if (query.read_state === entry_utils.ENTRY_STATE_UNREAD) {
      // any feed, unread

      // in this case we want to open a cursor on [readState, date], using
      // [unread, min_date] as lower bound, and [unread, max_date] as upper
      // bound, and then specify direction accordingly
      // TODO: i think we can even use a 1 element array, just use [unread]
    } else {
      // any feed, read
      // similar to unread above, but this time use [read]
    }
  } else {
    if (query.read_state === undefined) {
      // particular feed, any read state
      // open a bounded cursor on the index [feed, date], using just [feed]

    } else if (query.read_state === entry_utils.ENTRY_STATE_UNREAD) {
      // particular feed, unread
      // open a bounded cursor on the index [feed, read state, date], specifying
      // just [feed, unread]

    } else {
      // particular feed, read
      // open a bounced cursor on index [feed, read state, date], specifying
      // jsut [feed, read]
    }
  }

  const cursor_state = {};
  // we pretend we already advanced if offset is 0 in order to simplify some of
  // the later logic in cursor iteration
  cursor_state.advanced = offset ? false : true;
  cursor_state.offset = offset;
  cursor_state.limit = limit;
  cursor_state.entries = entries;
  cursor_state.callback = resolve;

  request.onsuccess = request_onsuccess.bind(request, cursor_state);
}

function request_onsuccess(cursor_state, event) {
  // TODO: implement me
  const cursor = event.target.result;

  // This is the iteration stopping condition. If there is no cursor, we are
  // done. We might not have encountered any entries at all, or we advanced the
  // cursor past the end.
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

  // If we are limited and reached the limit, then do not continue
  // NOTE: technically the condition should just be === limit, and >= is just
  // kind of a relaxed condition out of paranoia, unclear understanding
  if (cursor_state.limit && cursor_state.entries.length >= cursor_state.limit) {
    return;
  }

  cursor.continue;
}

function is_valid_offset(offset) {
  return offset === undefined || (Number.isInteger(offset) && offset >= 0);
}

function is_valid_read_state(state) {
  return state === undefined || state === entry_utils.ENTRY_STATE_READ ||
      state === entry_utils.ENTRY_STATE_UNREAD
}
