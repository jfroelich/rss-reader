import {lookup as lookupFavicon, open as openIconDb} from '/src/favicon-service.js';
import {createIconLookupURLForFeed, feedHasURL, findActiveFeeds, open as openReaderDb, putFeed} from '/src/rdb.js';

// Refreshes the favicon property of feeds in the feed store
export default async function refreshFeedIcons(feedConn, iconConn, channel) {
  const dconn = feedConn ? feedConn : await openReaderDb();
  const feeds = await findActiveFeeds(dconn);
  const partial = refreshFeedIcon.bind(null, dconn, iconConn, channel);
  const promises = feeds.map(partial);
  await Promise.all(promises);
  if (!feedConn) {
    dconn.close();
  }
}

async function refreshFeedIcon(conn, iconConn, channel, feed) {
  if (!feedHasURL(feed)) {
    throw new TypeError('Feed missing url ' + feed.id);
  }

  // Throw on failure
  const lookupURL = createIconLookupURLForFeed(feed);

  const lookupContext = {};
  lookupContext.conn = iconConn;
  lookupContext.url = lookupURL;

  // lookup errors are not fatal
  let iconURL;
  try {
    iconURL = await lookupFavicon(lookupContext);
  } catch (error) {
    console.debug(error);
  }

  // If state changed then update
  if (feed.faviconURLString !== iconURL) {
    if (iconURL) {
      feed.faviconURLString = iconURL;
    } else {
      delete feed.faviconURLString;
    }

    feed.dateUpdated = new Date();

    try {
      await putFeed(conn, channel, feed);
    } catch (error) {
      console.error(error);
    }
  }
}
