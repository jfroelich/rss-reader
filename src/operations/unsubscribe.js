import {delete_feed} from '/src/operations/delete-feed.js';
import * as badge from '/src/badge.js';

// TODO: create docs

// TODO: this shouldn't be dependent on badge.update, it should be the
// other way around. See notes in badge.js. There is a chance there
// is no need to call it here. In which case, unsubscribe devolves into merely
// an alias of delete_feed, and for that matter, the caller can just
// call delete_feed directly, and I could also consider renaming
// delete_feed to unsubscribe.

// TODO: actually, see what i did with deprecating mark-read when moving to
// syscalls api pattern. it is ok to use badge. so in really this should be
// entirely deprepcated, the badge update should be moved into the delete feed
// call, caller should call delete feed directly. and for that matter i should
// consider renaming delete_feed to unsubscribe

// Remove a feed and its entries from the database
// @param conn {IDBDatabase} an open database connection, required
// @param channel {BroadcastChannel} optional, this dispatches feed deleted and
// entry deleted messages to the given channel
// @param feed_id {Number} id of feed to unsubscribe
export default async function unsubscribe(conn, channel, feed_id) {
  if (!(conn instanceof IDBDatabase)) {
    throw new TypeError('Invalid conn ' + conn);
  }

  const reason_text = 'unsubscribe';
  await delete_feed(conn, channel, feed_id, reason_text);

  // Removing entries may impact the unread count, so update the badge
  badge.update(conn).catch(console.error);  // non-awaited
}
