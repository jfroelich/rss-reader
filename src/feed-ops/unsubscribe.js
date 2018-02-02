import {feed_store_remove_feed} from '/src/rdb.js';
import badge_update_text from '/src/views/update-badge-text.js';

// TODO: this shouldn't be dependent on something in the view, it should be the
// other way around

// TODO: see notes in update-badge-text.js. There is a chance there is no need
// to call it here. In which case, unsubscribe devolves into merely an alias of
// feed_store_remove_feed, and for that matter, the caller can just call
// feed_store_remove_feed directly, and I could also consider renaming
// feed_store_remove_feed to unsubscribe.

// Remove a feed and its entries from the database
// @param conn {IDBDatabase} an open feed store instance. Optional. If not
// defined then a connection is automatically opened and closed.
// @param channel {BroadcastChannel} optional, this dispatches feed deleted and
// entry deleted messages to the given channel
// @param feed_id {Number} id of feed to unsubscribe
export default async function unsubscribe(conn, channel, feed_id) {
  const reason_text = 'unsubscribe';
  await feed_store_remove_feed(conn, channel, feed_id, reason_text);

  // Removing entries may impact the unread count
  badge_update_text(conn);  // non-blocking
}
