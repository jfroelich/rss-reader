import assert from "/src/common/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import updateBadgeText from "/src/update-badge-text.js";
import * as Feed from "/src/feed-store/feed.js";

// Remove a feed and its entries from the database and notify the UI
// @param feedId {Number} id of feed to unsubscribe
// @param store {FeedStore} an open FeedStore instance
// @param channel {BroadcastChannel} this dispatches feed deleted and
// entry deleted type messages to the reader channel
export default async function unsubscribe(feedId, store, channel) {
  assert(Feed.isValidId(feedId));
  assert(store instanceof FeedStore);
  assert(store.isOpen());
  assert(channel instanceof BroadcastChannel);

  const entryIds = await store.findEntryIdsByFeedId(feedId);
  await store.removeFeed(feedId, entryIds);

  channel.postMessage({type: 'feed-deleted', id: feedId, reason: 'unsubscribe'});
  for(const entryId of entryIds) {
    channel.postMessage({type: 'entry-deleted', id: entryId, reason: 'unsubscribe'});
  }

  updateBadgeText();
}
