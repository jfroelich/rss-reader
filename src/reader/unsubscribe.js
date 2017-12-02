import assert from "/src/assert/assert.js";
import * as Feed from "/src/reader-db/feed.js";
import findEntryIdsByFeedIdInDb from "/src/reader-db/find-entry-ids-by-feed-id.js";
import removeFeedFromDb from "/src/reader-db/remove-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as idb from "/src/utils/indexeddb-utils.js";

// @param channel {BroadcastChannel} optional, if specified then this dispatches feed deleted and
// entry deleted type messages to the channel
export default async function unsubscribe(feedId, conn, channel) {
  assert(idb.isOpen(conn));
  assert(Feed.isValidId(feedId));

  const entryIds = await findEntryIdsByFeedIdInDb(conn, feedId);
  await removeFeedFromDb(conn, feedId, entryIds);

  if(channel) {
    channel.postMessage({type: 'feed-deleted', id: feedId, reason: 'unsubscribe'});
    for(const entryId of entryIds) {
      channel.postMessage({type: 'entry-deleted', id: entryId, reason: 'unsubscribe'});
    }
  }

  await updateBadgeText(conn);
}
