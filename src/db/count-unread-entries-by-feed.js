import * as entry_utils from '/src/db/entry-utils.js';

// TODO: optimize
// TODO: idea. i query for all unread entries. i query for all feeds. then
// in memory i loop over the entries, and update an in memory count per feed.
// or would that not be any better?
export async function count_unread_entries_by_feed(session, id) {
  return new Promise((resolve, reject) => {
    const txn = session.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('feed-readState');
    const range_only_value = [id, entry_utils.ENTRY_STATE_UNREAD];
    const request = index.count(range_only_value);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}
