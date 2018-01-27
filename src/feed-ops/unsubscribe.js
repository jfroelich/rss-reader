import updateBadgeText from "/src/views/update-badge-text.js";
import {removeFeed} from "/src/rdb.js";

// TODO: this shouldn't be dependent on something in the view, it should be the other way
// around

// TODO: see notes in update-badge-text.js. There is a chance there is no need to call it here.
// In which case, unsubscribe devolves into merely an alias of removeFeed, and for that
// matter, the caller can just call removeFeed directly, and I could also consider
// renaming removeFeed to unsubscribe.

// Remove a feed and its entries from the database
// @param conn {IDBDatabase} an open feed store instance. Optional. If not defined then a
// connection is automatically opened and closed.
// @param channel {BroadcastChannel} optional, this dispatches feed deleted and
// entry deleted messages to the given channel
// @param feedId {Number} id of feed to unsubscribe

export default async function unsubscribe(conn, channel, feedId) {
  const reasonText = 'unsubscribe';
  await removeFeed(conn, channel, feedId, reasonText);

  // Removing entries may impact the unread count
  updateBadgeText(conn);// non-blocking
}
