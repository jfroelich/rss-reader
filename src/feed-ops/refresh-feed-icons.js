import assert from "/src/common/assert.js";
import * as Status from "/src/common/status.js";
import {lookup, open as openIconStore} from "/src/favicon-service.js";
import * as Feed from "/src/feed-store/feed.js";
import {findActiveFeeds, open as openFeedStore, putFeed} from "/src/feed-store/feed-store.js";

// TODO: revert to no status
// TODO: fix bugs after change to iconConn


export default async function refreshFeedIcons(feedConn, iconConn, channel) {

  const dconn = conn ? conn : await openFeedStore();
  const feeds = await findActiveFeeds(dconn);

  const query = {};
  query.conn = iconConn;

  const promises = [];
  for(const feed of feeds) {
    promises.push(refreshFeedIcon(dconn, channel, query, feed));
  }
  await Promise.all(promises);

  if(!conn) {
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
// If I do two trans, and new feed is subscribed in between, then the in-mem lookup
// will fail. So not a perfect solution

async function refreshFeedIcon(conn, channel, query, feed) {
  // This should certainly fail uncaught, this should never happen
  assert(Feed.hasURL(feed));

  // This should certainly fail uncaught, this should never happen
  const lookupURL = Feed.createIconLookupURL(feed);

  // TODO: decoupling status blocked until favicon service overhauled

  let status, iconURL;
  [status, iconURL] = await query.lookup(lookupURL);
  if(status !== Status.OK) {
    console.debug('Error looking up favicon', Status.toString(status));
    return;
  }

  // If state changed then update
  if(feed.faviconURLString !== iconURL) {
    feed.faviconURLString = iconURL;
    feed.dateUpdated = new Date();
    if(!feed.faviconURLString) {
      delete feed.faviconURLString;
    }
    await putFeed(conn, channel, feed);
  }
}
