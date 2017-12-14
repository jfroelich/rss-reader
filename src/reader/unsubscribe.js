import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Feed from "/src/feed-store/feed.js";

// Remove a feed and its entries from the database and notify the UI
// @param feedId {Number} id of feed to unsubscribe
// @param store {FeedStore} an open FeedStore instance
// @param channel {BroadcastChannel} optional, if specified then this dispatches feed deleted and
// entry deleted type messages to the reader channel
export default async function unsubscribe(feedId, store, channel) {
  assert(Feed.isValidId(feedId));
  assert(store instanceof FeedStore);
  assert(store.isOpen());
  if(channel) {
    assert(channel instanceof BroadcastChannel);
  }

  const entryIds = store.findEntryIdsByFeedId(feedId);
  await store.removeFeed(feedId, entryIds);

  if(channel) {
    channel.postMessage({type: 'feed-deleted', id: feedId, reason: 'unsubscribe'});
    for(const entryId of entryIds) {
      channel.postMessage({type: 'entry-deleted', id: entryId, reason: 'unsubscribe'});
    }
  }

  await updateBadgeText(store);
}
