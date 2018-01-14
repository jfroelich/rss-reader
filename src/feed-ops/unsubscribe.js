import * as Status from "/src/common/status.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";

// Remove a feed and its entries from the database and notify observers
// @param store {FeedStore} an open FeedStore instance
// @param channel {BroadcastChannel} optional, this dispatches feed deleted and
// entry deleted type messages to the given channel
// @param feedId {Number} id of feed to unsubscribe

export default async function unsubscribe(store, channel, feedId) {
  const reasonText = 'unsubscribe';
  const status = await store.removeFeed(feedId, channel, reasonText);
  if(status !== Status.OK) {
    console.error(Status.toString(status));
    return status;
  }

  // Removing entries may impact the unread count
  updateBadgeText().catch(console.error);
  return Status.OK;
}
