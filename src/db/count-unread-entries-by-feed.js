import * as entry_utils from '/src/db/entry-utils.js';

// Return the number of unread entries for the given feed
// NOTE: this is not optimized, this is just getting something working stage
// TODO: idea. i query for all unread entries. i query for all feeds. then
// in memory i loop over the entries, and update an in memory count per feed.
// or would that not be any better?
export async function count_unread_entries_by_feed(session, id) {
  const bound =
      count_unread_entries_by_feed_executor.bind(null, session.conn, id);
  return new Promise(bound);
}

function count_unread_entries_by_feed_executor(conn, id, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  // Use the new index created in version 25
  const index = store.index('feed-readState');
  const range_only_value = [id, entry_utils.ENTRY_STATE_UNREAD];
  const request = index.count(range_only_value);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}
