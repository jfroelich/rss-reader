import assert from "/src/assert/assert.js";
import {isOpen} from "/src/indexeddb/utils.js";
import getFeedsFromDb from "/src/reader-db/get-feeds.js";

// NOTE: if performance eventually becomes a material concern this should probably interact
// directly with the database. For now, because the filtering is done after deserialization there
// is not much benefit to direct interaction and instead it makes more sense to leverage existing
// functionality.

export default async function getActiveFeedsFromDb(conn) {
  assert(isOpen(conn));

  // If getFeedsFromDb rejects then throw an exception
  const feeds = await getFeedsFromDb(conn);
  const activeFeeds = feeds.filter(isActiveFeed);
  return activeFeeds;
}

// Explicitly test whether the active property is defined and of boolean type. This is just
// an extra sanity check in case the property gets clobbered somewhere. But rather than a full
// on assert I do not handle the error explicitly and consider the feed as inactive. What this
// means is that if I ever see no feeds being loaded but I know they exist, this is probably
// the reason.
function isActiveFeed(feed) {
  return feed.active === true;
}
