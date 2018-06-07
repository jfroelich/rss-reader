import {refresh_badge} from '/src/badge.js';
import {iterate_entries} from '/src/reader-db.js';

// Removes entries missing urls from the database
export async function remove_lost_entries(conn, channel) {
  // Track ids so they are available after txn commits
  const deleted_entry_ids = [];
  const txn_writable = true;
  await iterate_entries(conn, 'all', txn_writable, cursor => {
    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      cursor.delete();
      deleted_entry_ids.push(entry.id);
    }
  });

  // Wait till txn commits before dispatch
  for (const id of deleted_entry_ids) {
    channel.postMessage({type: 'entry-deleted', id: id, reason: 'lost'});
  }

  if (deleted_entry_ids.length) {
    refresh_badge(conn).catch(console.error);  // non-blocking
  }
}
