import assert from "/src/assert.js";
import {check, isUncheckedError, PermissionsError} from "/src/utils/errors.js";
import {showNotification} from "/src/extension.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import * as Feed from "/src/storage/feed.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import isAllowedURL from "/src/fetch/fetch-policy.js";
import * as rdb from "/src/storage/rdb.js";
import parseFeed from "/src/reader/parse-feed.js";
import feedPut from "/src/storage/feed-put.js";
import {setURLHrefProperty} from "/src/url/url.js";

// Module for subscribing to a new feed


export function Context() {
  this.iconCache = undefined;
  this.readerConn = undefined;
  this.fetchFeedTimeoutMs = 2000;
  this.notify = true;
}

// Opens database connections
Context.prototype.connect = async function() {
  this.iconCache = new FaviconCache();
  const promises = [rdb.open(), this.iconCache.open()];
  [this.readerConn] = await Promise.all(promises);
};

// Closes database connections
Context.prototype.close = function() {
  if(this.iconCache) {
    this.iconCache.close();
  }

  rdb.close(this.readerConn);
};

// @param this {Context}
// @param feed {Object} the feed to subscribe to
// @returns {Object} the subscribed feed
export async function subscribe(feed) {
  assert(this instanceof Context);
  assert(rdb.isOpen(this.readerConn));
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const url = Feed.peekURL(feed);

  // Check whether policy permits subscribing to the url
  const urlObject = new URL(url);
  check(isAllowedURL(urlObject), PermissionsError, urlObject, 'not permitted');

  // Check that user is not already subscribed
  let priorFeedId = await rdb.findFeedIdByURL(this.readerConn, url);
  check(!priorFeedId, rdb.ConstraintError, 'already subscribed');

  if(navigator.onLine || !('onLine' in navigator)) {
    // If online then fetch failure is fatal to subscribing
    const res = await fetchFeed(url, this.fetchFeedTimeoutMs);

    // If redirected, then the url changed. Perform checks on the new url
    if(res.redirected) {
      // Check whether policy permits subscribing to the redirected url
      setURLHrefProperty(urlObject, res.responseURL);
      check(isAllowedURL(urlObject), PermissionsError, urlObject, 'not permitted');

      // Check that user is not already subscribed now that we know redirect
      priorFeedId = await rdb.findFeedIdByURL(this.readerConn, res.responseURL);
      check(!priorFeedId, rdb.ConstraintError, 'already subscribed');
    }

    // Get the fetched details
    const xml = await res.text();
    const kProcEntries = false;
    const parseResult = parseFeed(xml, url, res.responseURL, res.lastModifiedDate, kProcEntries);
    feed = Feed.merge(feed, parseResult.feed);
  }

  // Set the feed's favicon
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  const lookupURL = Feed.createIconLookupURL(feed);
  try {
    const iconURLString = await query.lookup(lookupURL);
    feed.faviconURLString = iconURLString;
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, lookup failure is non-fatal
    }
  }

  // Store the feed in the database
  const kSkipPrep = false;
  const storedFeed = await feedPut(feed, this.readerConn, kSkipPrep);

  // Send a notification of the successful subscription
  if(this.notify) {
    const title = 'Subscribed';
    const feedName = storedFeed.title || Feed.peekURL(storedFeed);
    const message = 'Subscribed to ' + feedName;
    showNotification(title, message, storedFeed.faviconURLString);
  }

  return storedFeed;
}