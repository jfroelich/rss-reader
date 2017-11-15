// Functionality for refreshing feed favicons

// TODO: consider overwriting existing icons too, given that some icons become invalid

import assert from "/src/assert.js";
import {isUncheckedError} from "/src/errors.js";
import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import * as Feed from "/src/feed.js";
import * as rdb from "/src/rdb.js";
import {feedPut} from "/src/reader-storage.js";

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
export default async function refreshFeedIcons(readerConn, iconConn) {
  assert(rdb.isOpen(readerConn));
  assert(rdb.isOpen(iconConn));

  const feeds = await rdb.getFeeds(readerConn);

  // This controls the feed object for its lifetime locally so there is no need
  // to prepare the feed before storing it back in the database
  const skipPrep = true;

  const promises = [];
  for(const feed of feeds) {
    promises.push(updateFeedIcon(feed, readerConn, iconConn, skipPrep));
  }

  // Allow any individual failure to cancel iteration and bubble an error
  // TODO: switch to promiseEvery
  await Promise.all(promises);
}

// TODO: this should accept a cache parameter instead of iconConn?

// Lookup the feed's icon, update the feed in db
// @param feed {Object}
// @param readerConn {IDBDatabase}
// @param iconConn {IDBDatabase}
// @param skipPrep {Boolean} whether to skip feed preparation when updating db
// @throws AssertionError
// @throws Error - database related
async function updateFeedIcon(feed, readerConn, iconConn, skipPrep) {
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  // TODO: abstract the lookup section of this function into a local helper function

  const query = new FaviconLookup();
  query.cache = new FaviconCache();
  query.cache.conn = iconConn;

  const url = Feed.createIconLookupURL(feed);
  assert(url);

  let iconURL;
  try {
    iconURL = await query.lookup(url);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      console.debug('favicon lookup error', url.href, error);
    }
  }

  const prevIconURL = feed.faviconURLString;

  // For some reason, this section of code always feels confusing, so I've made it extremely
  // explicit
  // TODO: remove debugging after further testing

  if(prevIconURL && iconURL && prevIconURL !== iconURL) {
    console.debug('feed with favicon changed favicon %s', iconURL);
    feed.faviconURLString = iconURL;
    await feedPut(feed, readerConn, skipPrep);
    return;
  }

  if(prevIconURL && iconURL && prevIconURL === iconURL) {
    console.debug('feed with favicon did not change (no database operation)', prevIconURL);
    return;
  }

  if(prevIconURL && !iconURL) {
    console.debug('removing feed favicon because lookup failed', url.href, prevIconURL);
    feed.faviconURLString = undefined;
    await feedPut(feed, readerConn, skipPrep);
    return;
  }

  if(!prevIconURL && !iconURL) {
    console.debug('feed did not have favicon, could not find favicon (no database operation)',
      url.href);
    return;
  }

  if(!prevIconURL && iconURL) {
    console.debug('setting initial feed favicon %s', iconURL);
    feed.faviconURLString = iconURL;
    await feedPut(feed, readerConn, skipPrep);
    return;// just for consistency
  }
}
