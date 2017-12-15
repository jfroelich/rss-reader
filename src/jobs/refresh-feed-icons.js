import assert from "/src/assert/assert.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedStore from "/src/feed-store/feed-store.js";
import * as Feed from "/src/feed-store/feed.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import promiseEvery from "/src/promise/every.js";

export default async function main(store, iconCache) {
  assert(store instanceof FeedStore);
  assert(iconCache instanceof FaviconCache);
  assert(store.isOpen());
  assert(iconCache.isOpen());

  // We only care about refreshing active feeds. Presumably if a feed is inactive either
  // it will not have a favicon (e.g. it is an unreachable network resource), or has not been
  // updated in some time which indicates its favicon probably hasn't changed, and finally we just
  // don't care about inactive feeds because they are generally no longer viewable.
  const feeds = await store.findActiveFeeds();
  const context = {store: store, iconCache: iconCache};
  const promises = feeds.map(updateFeedIcon, context);
  await promiseEvery(promises);
}

async function updateFeedIcon(feed) {
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  // Lookup the feed's favicon
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  const url = Feed.createIconLookupURL(feed);

  // @type {String}
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

  // This section is very explicit and redundant because the condensed version is confusing to read

  // The feed had a favicon, and it changed to a different favicon
  if(prevIconURL && iconURL && prevIconURL !== iconURL) {
    await putFeedHelper(this.store, iconURL, feed);
    return;
  }

  // The feed had a favicon, and a favicon was found, and it did not change
  if(prevIconURL && iconURL && prevIconURL === iconURL) {
    return;
  }

  // The feed had a favicon, and no new favicon was found
  if(prevIconURL && !iconURL) {
    await putFeedHelper(this.store, void iconURL, feed);
    return;
  }

  // The feed did not have a favicon, and no new favicon was found
  if(!prevIconURL && !iconURL) {
    return;
  }

  // The feed did not have a favicon, and a new favicon was found
  if(!prevIconURL && iconURL) {
    await putFeedHelper(this.store, iconURL, feed);
    return;
  }
}

function putFeedHelper(store, urlString, feed) {
  feed.faviconURLString = urlString;
  feed.dateUpdated = new Date();
  return store.putFeed(feed);
}
