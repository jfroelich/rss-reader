import assert from "/src/assert/assert.js";
import * as Feed from "/src/reader-db/feed.js";
import findFeedByIdInDb from "/src/reader-db/find-feed-by-id.js";
import putFeedInDb from "/src/reader-db/put-feed.js";

// TODO: test. I suppose to test I should provide an easy way of deactivating a feed manually
// so that I can easily reactivate it. At the moment feeds can only be deactivated automatically
// as a result of repeated errors.

export default function activateFeed(conn, feedId) {
  assert(IndexedDbUtils.isOpen(conn));
  assert(Feed.isValidId(feedId));

  console.debug('Activating feed', feedId);
  const feed = await findFeedByIdInDb(conn, feedId);
  assert(Feed.isFeed(feed));

  console.debug('Successfully loaded feed object', feed);

  if(feed.active === true) {
    console.debug('Feed with id %d is already active', feed.id);
    return false;
  }


  feed.active = true;

  // I guess just permanently erase?
  delete feed.deactivationReasonText;
  delete feed.deactivationDate;

  feed.dateUpdated = new Date();

  // We have full control
  const skipPrep = true;
  await putFeedInDb(feed, conn, skipPrep);
  console.debug('Activated feed', feedId);
  return true;
}
