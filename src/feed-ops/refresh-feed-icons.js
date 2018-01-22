import {lookup, open as openIconStore} from "/src/favicon-service.js";
import {
  createIconLookupURLForFeed,
  feedHasURL,
  findActiveFeeds,
  open as openFeedStore,
  putFeed
} from "/src/rdb.js";

// Refreshes the favicon property of feeds in the feed store
export default async function refreshFeedIcons(feedConn, iconConn, channel) {
  const dconn = feedConn ? feedConn : await openFeedStore();
  const feeds = await findActiveFeeds(dconn);

  const promises = [];
  for(const feed of feeds) {
    promises.push(refreshFeedIcon(dconn, iconConn, channel, feed));
  }
  await Promise.all(promises);

  if(!feedConn) {
    dconn.close();
  }
}

// TODO: in order to use Promise.all, this should not throw except in really
// exceptional case. putFeed can fail because this is not transactionally safe. It
// cannot be transactionally safe because I read, then fetch, then write. Consider
// ways of making it transactionally safe. For example, I could read once by itself,
// do lookups, then do a second transaction that re-reads and writes together. For the
// second transaction I would do a sync lookup to the local in memory data structure.
// On other hand, why would putFeed actually fail? I am not attempting an add, I am
// doing a replace. Suppose a feed is unsubscribed. This will recreate? Maybe that
// is sufficient reason?
// If I do two passes, and new feed is subscribed in between, then the in-mem lookup
// will fail. So not a perfect solution

async function refreshFeedIcon(conn, iconConn, channel, feed) {
  if(!feedHasURL(feed)) {
    throw new TypeError('Feed missing url ' + feed.id);
  }

  // Throw on failure
  const lookupURL = createIconLookupURLForFeed(feed);

  const query = {};
  query.conn = iconConn;
  query.url = lookupURL;

  // lookup can fail for a variety of reasons, not just programming errors
  let iconURL;
  try {
    iconURL = await lookup(query);
  } catch(error) {
    console.debug(error);
  }

  // If state changed then update
  if(feed.faviconURLString !== iconURL) {
    if(iconURL) {
      feed.faviconURLString = iconURL;
    } else {
      delete feed.faviconURLString;
    }

    feed.dateUpdated = new Date();

    // This put call generally should not fail, but it sometimes can, because this method is
    // not transactionally safe, because reading the feeds into memory occurs in a
    // separate transaction from writing a feed, and in between, the feed may have been
    // deleted or something to that effect. Just log the error, but suppress it.

    // Example:
    // 1. load feed in transaction 1.
    // 2. lookup favicon.
    // 3. another process deletes the feed. transaction 2.
    // 4. another process creates a new feed, with different urls. transaction 3.
    // 5. this attempts to store the feed. transaction 4.
    // 6. indexedDB faults with a constraint error on the url index of feed store.

    // The problem is basically that transaction 1 and 4 are not the same transaction, but
    // this acts like it is guaranteed. This is why the try/catch is needed.

    // I'd like to make transaction 1 and 4 the same, but am not sure how to proceed. indexedDB
    // doesn't support the extra async calls in between the requests, the transaction will
    // auto-close after timing out when not detecting the second request in time, during the
    // time in which the extra async call is pending.

    try {
      await putFeed(conn, channel, feed);
    } catch(error) {
      console.error(error);
    }
  }
}
