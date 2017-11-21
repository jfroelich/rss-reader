// Functionality for refreshing feed favicons

import assert from "/src/assert.js";
import {isUncheckedError} from "/src/utils/errors.js";
import FaviconLookup from "/src/favicon/lookup.js";
import * as Feed from "/src/storage/feed.js";
import {promiseEvery} from "/src/utils/promise.js";
import feedPut from "/src/storage/feed-put.js";
import * as rdb from "/src/storage/rdb.js";

export default async function main(readerConn, iconCache) {
  assert(rdb.isOpen(readerConn));
  assert(iconCache.isOpen());
  const feeds = await rdb.getFeeds(readerConn);
  const context = {readerConn: readerConn, iconCache: iconCache};
  await promiseEvery(feeds.map(updateFeedIcon, context));
}

async function updateFeedIcon(feed) {
  assert(this.readerConn);
  assert(this.iconCache);
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  // Lookup the feed's favicon
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  const url = Feed.createIconLookupURL(feed);
  let iconURL;
  try {
    iconURL = await query.lookup(url);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Lookup failure is not fatal
    }
  }

  const prevIconURL = feed.faviconURLString;

  // For some reason, this section of code always feels confusing, so I've made it extremely
  // explicit. Yes, there are redundant if conditions.

  // This module controls each feed object for its lifetime locally so there is no need
  // to prepare each feed before storing it back in the database because there is no sanitization
  // concern.
  const skipPrep = true;

  // The feed had a favicon, and it changed to a different favicon
  if(prevIconURL && iconURL && prevIconURL !== iconURL) {
    feed.faviconURLString = iconURL;
    await feedPut(feed, this.readerConn, skipPrep);
    return;
  }

  // The feed had a favicon, and it did not change
  if(prevIconURL && iconURL && prevIconURL === iconURL) {
    return;
  }

  // The feed had a favicon, but no new favicon found
  if(prevIconURL && !iconURL) {
    feed.faviconURLString = undefined;
    await feedPut(feed, this.readerConn, skipPrep);
    return;
  }

  // The feed did not have a favicon, and no new favicon found
  if(!prevIconURL && !iconURL) {
    return;
  }

  // The feed did not have a favicon, but a new favicon was found
  if(!prevIconURL && iconURL) {
    feed.faviconURLString = iconURL;
    await feedPut(feed, this.readerConn, skipPrep);
    return;// just for consistency
  }
}
