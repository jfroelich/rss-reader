// TODO: remove reliance on CheckedError
import {CheckedError} from "/src/common/errors.js";

import * as Status from "/src/common/status.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";


export default async function refreshFeedIcons(feedStore, iconCache) {
  if(!(feedStore instanceof FeedStore)) {
    console.error('Invalid feedStore argument', feedStore);
    return Status.EINVAL;
  }

  if(!feedStore.isOpen()) {
    console.error('feed store is not open');
    return Status.EINVALIDSTATE;
  }

  if(!(iconCache instanceof FaviconCache)) {
    console.error('Invalid iconCache argument', iconCache);
    return Status.EINVAL;
  }

  if(!iconCache.isOpen()) {
    console.error('Favicon cache is not open');
    return Status.EINVALIDSTATE;
  }

  let [status, feeds] = await feedStore.findActiveFeeds();
  if(status !== Status.OK) {
    console.error('Failed to find active feeds with status', status);
    return status;
  }

  const query = new FaviconLookup();
  query.cache = iconCache;

  const promises = [];
  for(const feed of feeds) {
    promises.push(refreshFeedIcon(feedStore, query, feed));
  }

  const results = await Promise.all(promises);
  for(const result of results) {
    if(result !== Status.OK) {
      console.error('refreshFeedIcon status not ok', result);
      return status;
    }
  }

  return Status.OK;
}

async function refreshFeedIcon(feedStore, query, feed) {
  if(!Feed.isFeed(feed)) {
    console.error('Invalid feed argument', feed);
    return Status.EINVAL;
  }

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

  if(prevIconURL && iconURL && prevIconURL !== iconURL) {
    feed.faviconURLString = iconURL;
    [status] = await feedStore.putFeed(feed);
    if(status !== Status.OK) {
      console.error('Failed to put feed with status', status);
      return status;
    }

  } else if(prevIconURL && iconURL && prevIconURL === iconURL) {
    // noop
  } else if(prevIconURL && !iconURL) {
    feed.faviconURLString = void prevIconURL;
    [status] = await feedStore.putFeed(feed);
    if(status !== Status.OK) {
      console.error('Failed to put feed with status', status);
      return status;
    }
  } else if(!prevIconURL && !iconURL) {
    // noop
  } else if(!prevIconURL && iconURL) {
    feed.faviconURLString = iconURL;
    [status] = await feedStore.putFeed(feed);
    if(status !== Status.OK) {
      console.error('Failed to put feed with status', status);
      return status;
    }
  } else {
    console.error('Unexpected state in refresh feed icons');
    return Status.EINVALIDSTATE;
  }

  return Status.OK;
}
