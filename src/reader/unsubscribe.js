import assert from "/src/assert.js";
import * as Feed from "/src/storage/feed.js";
import * as rdb from "/src/storage/rdb.js";
import findEntryIdsByFeedIdInDb from "/src/storage/find-entry-ids-by-feed-id.js";
import removeFeedFromDb from "/src/storage/remove-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as idb from "/src/utils/indexeddb-utils.js";

export default async function unsubscribe(feedId, conn) {
  assert(idb.isOpen(conn));
  assert(Feed.isValidId(feedId));

  const entryIds = await findEntryIdsByFeedIdInDb(conn, feedId);
  await removeFeedFromDb(conn, feedId, entryIds);

  const channel = new BroadcastChannel('db');
  channel.postMessage({type: 'feed-deleted', id: feedId});
  for(const entryId of entryIds) {
    channel.postMessage({type: 'entry-deleted', id: entryId});
  }
  channel.close();

  await updateBadgeText(conn);
}
