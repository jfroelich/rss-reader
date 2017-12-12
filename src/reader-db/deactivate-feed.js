import assert from "/src/assert/assert.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import * as Feed from "/src/reader-db/feed.js";
import findFeedByIdInDb from "/src/reader-db/find-feed-by-id.js";
import putFeedInDb from "/src/reader-db/put-feed.js";

export default async function deactivateFeed(conn, feedId, reason) {
  assert(IndexedDbUtils.isOpen(conn));
  assert(Feed.isValidId(feedId));

  console.debug('Deactivating feed', feedId);
  const feed = await findFeedByIdInDb(conn, feedId);
  assert(Feed.isFeed(feed));

  console.debug('Successfully loaded feed object for deactivation', feed);

  if(feed.active === false) {
    console.warn('Feed %d is inactive', feed.id);
    return false;
  }

  changeFeedPropsToInactive(feed, reason);

  // We have full control
  const skipPrep = true;
  await putFeedInDb(feed, conn, skipPrep);
  console.debug('Deactivated feed', feedId);
  return true;
}

export function changeFeedPropsToInactive(feed, reason) {
  feed.active = false;
  if(typeof reason === 'string') {
    feed.deactivationReasonText = reason;
  }

  const currentDate = new Date();
  feed.deactivationDate = currentDate;
  feed.dateUpdated = currentDate;
}
