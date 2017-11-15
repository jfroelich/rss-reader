// Class for subscribing to a new feed

// TODO: write member functions out of line so it is more readable, I hate this class syntax, it
// is too symptomatic of trying to overly condense things to the point where intent is obfuscated
// TODO: now that modules are available, this class barely serves any purpose. Just export a single
// function or two, but do this after successful transition to modules

import assert from "/src/assert.js";
import {check, isUncheckedError, PermissionsError} from "/src/errors.js";
import {showNotification} from "/src/extension.js";
import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import * as Feed from "/src/feed.js";
import {fetchFeed} from "/src/fetch.js";
import isAllowedURL from "/src/fetch-policy.js";
import {isOpen as isOpenDB} from "/src/idb.js";
import updateBadgeText from "/src/update-badge-text.js";
import * as rdb from "/src/rdb.js";
import {readerParseFeed} from "/src/reader-parse-feed.js";
import {feedPut} from "/src/reader-storage.js";


export class SubscribeRequest {
  constructor() {
    this.iconCache = undefined;
    this.readerConn = undefined;
    this.timeoutMs = 2000;
    this.notify = true;
  }

  // Open database connections
  async connect() {
    this.iconCache = new FaviconCache();
    let _;
    const promises = [rdb.open(), this.iconCache.open()];
    [this.readerConn, _] = await Promise.all(promises);
  }

  // Close database connections
  close() {
    if(this.iconCache) {
      this.iconCache.close();
    }

    rdb.close(this.readerConn);
  }

  // Returns a promise that resolves to the id of a feed matching the url
  isSubscribed(url) {
    return rdb.findFeedIdByURL(this.readerConn, url);
  }

  // @param feed {Object} the feed to subscribe to
  // @throws {AssertionError}
  // @throws {Error} database-related
  // @throws {Error} parse related
  // @throws {Error} fetch related
  // @returns {Object} the subscribed feed
  async subscribe(feed) {
    assert(rdb.isOpen(this.readerConn));
    assert(this.iconCache instanceof FaviconCache);

    // TODO: law of demeter violation, use this.iconCache.isOpen after implementing it
    assert(isOpenDB(this.iconCache.conn));

    assert(Feed.isFeed(feed));
    assert(Feed.hasURL(feed));

    const url = Feed.peekURL(feed);

    check(isAllowedURL(url), PermissionsError, url + ' not permitted');
    check(!(await this.isSubscribed(url)), rdb.ConstraintError, 'already subscribed');

    if(navigator.onLine || !('onLine' in navigator)) {
      const res = await fetchFeed(url, this.timeoutMs);
      if(res.redirected) {
        check(!(await this.isSubscribed(res.responseURL)), rdb.ConstraintError,
          'already subscribed');
      }

      const xml = await res.text();
      const PROCESS_ENTRIES = false;
      const parseResult = readerParseFeed(xml, url, res.responseURL, res.lastModifiedDate,
        PROCESS_ENTRIES);
      const mergedFeed = Feed.merge(feed, parseResult.feed);
      feed = mergedFeed;
    }

    await this.setFavicon(feed);
    const storedFeed = await this.addFeed(feed);
    this.showNotification(storedFeed);
    return storedFeed;
  }

  async addFeed(feed) {
    const SKIP_PREP = false;
    const storedFeed = await feedPut(feed, this.readerConn, SKIP_PREP);
    return storedFeed;
  }

  showNotification(feed) {
    if(!this.notify) {
      return;
    }

    const title = 'Subscribed';
    const feedName = feed.title || Feed.peekURL(feed);
    const message = 'Subscribed to ' + feedName;
    showNotification(title, message, feed.faviconURLString);
  }

  async setFavicon(feed) {
    const query = new FaviconLookup();
    query.cache = this.iconCache;
    query.skipURLFetch = true;
    const url = Feed.createIconLookupURL(feed);
    try {
      const iconURL = await query.lookup(url);
      feed.faviconURLString = iconURL;
    } catch(error) {
      if(isUncheckedError(error)) {
        throw error;
      } else {
        // ignore, lookup failure is non-fatal
      }
    }
  }

  // TODO: deprecate, inline this into caller
  // Concurrently subscribe to each feed
  subscribeAll(feeds) {
    const promises = feeds.map(this.subscribe);
    // TODO: use promiseEvery?
    return Promise.all(promises);
  }

  // TODO: move to unsubscribe.js

  // @throws AssertionError
  // @throws Error database-related
  async remove(feedId) {
    assert(rdb.isOpen(this.readerConn));
    assert(Feed.isValidId(feedId));
    const entryIds = await rdb.findEntryIdsByFeedId(this.readerConn, feedId);
    await rdb.removeFeedAndEntries(this.readerConn, feedId, entryIds);
    await updateBadgeText(this.readerConn);
    const channel = new BroadcastChannel('db');
    channel.postMessage({type: 'feed-deleted', id: feedId});
    for(const entryId of entryIds) {
      channel.postMessage({type: 'entry-deleted', id: entryId});
    }
    channel.close();
  }
}
