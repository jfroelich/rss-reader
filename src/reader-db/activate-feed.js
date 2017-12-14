import assert from "/src/assert/assert.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import * as Feed from "/src/reader-db/feed.js";

export default async function activateFeed(conn, feedId) {
  assert(IndexedDbUtils.isOpen(conn));
  assert(Feed.isValidId(feedId));

  console.debug('Activating feed', feedId);

  // TEMP: hack
  const store = new FeedStore();
  store.conn = conn;

  const feed = await store.findFeedById(feedId);
  assert(Feed.isFeed(feed));

  console.debug('Successfully loaded feed object', feed);

  if(feed.active === true) {
    console.debug('Feed with id %d is already active', feed.id);
    return false;
  }

  changeFeedPropsToActive(feed);

  // We have full control
  const skipPrep = true;
  await store.putFeed(feed, skipPrep);
  console.debug('Activated feed', feedId);
  return true;
}

export function changeFeedPropsToActive(feed) {
  feed.active = true;
  // I guess just permanently erase?
  delete feed.deactivationReasonText;
  delete feed.deactivationDate;
  feed.dateUpdated = new Date();
}
