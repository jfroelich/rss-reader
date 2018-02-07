import {rdb_feed_remove} from '/src/rdb.js';
import badge_update_text from '/src/views/update-badge-text.js';

// TODO: this shouldn't be dependent on badge_update_text, it should be the
// other way around. See notes in update-badge-text.js. There is a chance there
// is no need to call it here. In which case, unsubscribe devolves into merely
// an alias of rdb_feed_remove, and for that matter, the caller can just
// call rdb_feed_remove directly, and I could also consider renaming
// rdb_feed_remove to unsubscribe.

// Remove a feed and its entries from the database
// @param conn {IDBDatabase} an open feed store instance. Optional. If not
// defined then a connection is automatically opened and closed.
// @param channel {BroadcastChannel} optional, this dispatches feed deleted and
// entry deleted messages to the given channel
// @param feed_id {Number} id of feed to unsubscribe
export default async function unsubscribe(conn, channel, feed_id) {
  const reason_text = 'unsubscribe';
  await rdb_feed_remove(conn, channel, feed_id, reason_text);

  // Removing entries may impact the unread count

  // TEMP: badge_update_text no longer auto-connects. I am logging this to
  // quickly fail if conn is not defined as required and expected here.
  assert(conn instanceof IDBDatabase);

  badge_update_text(conn).catch(console.error);  // non-awaited
}
