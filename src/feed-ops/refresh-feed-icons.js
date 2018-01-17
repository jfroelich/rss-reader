import * as Status from "/src/common/status.js";
import {FaviconCache, FaviconService} from "/src/favicon-service/favicon-service.js";
import * as Feed from "/src/feed-store/feed.js";
import {findActiveFeeds, putFeed} from "/src/feed-store/feed-store.js";

export default async function refreshFeedIcons(conn, iconCache) {

  let feeds;
  try {
    feeds = await findActiveFeeds(conn);
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  const query = new FaviconService();
  query.cache = iconCache;

  const promises = [];
  for(const feed of feeds) {
    promises.push(refreshFeedIcon(conn, query, feed));
  }

  const results = await Promise.all(promises);
  for(const result of results) {
    if(result !== Status.OK) {
      console.error('refreshFeedIcon status not ok', Status.toString(result));
      return result;
    }
  }

  return Status.OK;
}

async function refreshFeedIcon(conn, query, feed) {
  if(!Feed.hasURL(feed)) {
    console.error('Feed missing url', feed);
    return Status.EINVAL;
  }

  const lookupURL = Feed.createIconLookupURL(feed);

  // 3 things can happen:
  // 1) iconURL is defined and lookup is success
  // 2) iconURL is undefined and lookup is still a success (no programming error)
  // 3) a programming error occured

  let status, iconURL;
  [status, iconURL] = await query.lookup(lookupURL);
  if(status !== Status.OK) {
    console.debug('Error looking up favicon', Status.toString(status));
    return status;
  }

  const prevIconURL = feed.faviconURLString;
  feed.dateUpdated = new Date();

  // TODO: use a channel for putFeed instead of null

  if(prevIconURL && iconURL && prevIconURL !== iconURL) {
    feed.faviconURLString = iconURL;

    try {
      await putFeed(conn, null, feed);
    } catch(error) {
      console.error(error);
      return Status.EDB;
    }

  } else if(prevIconURL && iconURL && prevIconURL === iconURL) {
    // noop
  } else if(prevIconURL && !iconURL) {
    delete feed.faviconURLString;

    try {
      await putFeed(conn, null, feed);
    } catch(error) {
      console.error(error);
      return Status.EDB;
    }

  } else if(!prevIconURL && !iconURL) {
    // noop
  } else if(!prevIconURL && iconURL) {
    feed.faviconURLString = iconURL;

    try {
      await putFeed(conn, null, feed);
    } catch(error) {
      console.error(error);
      return Status.EDB;
    }

  } else {
    console.error('Unexpected state');
    return Status.EINVALIDSTATE;
  }

  return Status.OK;
}
