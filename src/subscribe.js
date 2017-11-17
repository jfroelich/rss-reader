// Class for subscribing to a new feed

import assert from "/src/assert.js";
import {check, isUncheckedError, PermissionsError} from "/src/errors.js";
import {showNotification} from "/src/extension.js";
import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import * as Feed from "/src/feed.js";
import {fetchFeed} from "/src/fetch.js";
import isAllowedURL from "/src/fetch-policy.js";
import * as rdb from "/src/rdb.js";
import parseFeed from "/src/reader/parse-feed.js";
import {feedPut} from "/src/reader-storage.js";

export function Context() {
  this.iconCache = undefined;
  this.readerConn = undefined;

  // TODO: this needs to have a more qualified name. Rename to something like fetchFeedTimeoutMs?
  this.timeoutMs = 2000;
  this.notify = true;
}

// Opens database connections
Context.prototype.connect = function() {
  this.iconCache = new FaviconCache();
  let _;
  const promises = [rdb.open(), this.iconCache.open()];
  [this.readerConn, _] = await Promise.all(promises);
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
  const urlObject = new URL(url);
  check(isAllowedURL(urlObject), PermissionsError, urlObject.href + ' not permitted');

  const isInputURLSubscribed = await isSubscribed.call(this, url);
  check(!isInputURLSubscribed, rdb.ConstraintError, 'already subscribed');

  if(navigator.onLine || !('onLine' in navigator)) {
    const res = await fetchFeed(url, this.timeoutMs);
    if(res.redirected) {
      const isRedirectURLSubscribed = await isSubscribed.call(this, res.responseURL);
      check(!isRedirectURLSubscribed, rdb.ConstraintError, 'already subscribed');
    }

    const xml = await res.text();
    const PROCESS_ENTRIES = false;
    const parseResult = parseFeed(xml, url, res.responseURL, res.lastModifiedDate,
      PROCESS_ENTRIES);
    const mergedFeed = Feed.merge(feed, parseResult.feed);
    feed = mergedFeed;
  }

  await setFavicon.call(this, feed);
  const SKIP_PREP = false;
  const storedFeed = feedPut(feed, this.readerConn, SKIP_PREP);
  showSubscribeNotification.call(this, storedFeed);
  return storedFeed;
}

// Returns a promise that resolves to the id of a feed matching the url
function isSubscribed(url) {
  return rdb.findFeedIdByURL(this.readerConn, url);
}

function showSubscribeNotification(feed) {
  if(!this.notify) {
    return;
  }

  const title = 'Subscribed';
  const feedName = feed.title || Feed.peekURL(feed);
  const message = 'Subscribed to ' + feedName;
  showNotification(title, message, feed.faviconURLString);
}

async function setFavicon(feed) {
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  const url = Feed.createIconLookupURL(feed);
  try {
    const iconURLString = await query.lookup(url);
    feed.faviconURLString = iconURLString;
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, lookup failure is non-fatal
    }
  }
}
