// Unsubscribe from a feed

import assert from "/src/utils/assert.js";
import * as Feed from "/src/feed.js";
import * as rdb from "/src/rdb.js";
import updateBadgeText from "/src/update-badge-text.js";

export default async function unsubscribe(feedId, conn) {
  assert(rdb.isOpen(conn));
  assert(Feed.isValidId(feedId));

  const entryIds = await rdb.findEntryIdsByFeedId(conn, feedId);
  await rdb.removeFeedAndEntries(conn, feedId, entryIds);

  const channel = new BroadcastChannel('db');
  channel.postMessage({type: 'feed-deleted', id: feedId});
  for(const entryId of entryIds) {
    channel.postMessage({type: 'entry-deleted', id: entryId});
  }
  channel.close();

  await updateBadgeText(conn);
}
