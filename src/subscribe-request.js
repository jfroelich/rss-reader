// Class for subscribing to a new feed

// TODO: write member functions out of line so it is more readable, I hate this class syntax, it
// is too symptomatic of trying to overly condense things to the point where intent is obfuscated
// TODO: now that modules are available, this class barely serves any purpose. Just export a single
// function or two, but do this after successful transition to modules

import assert from "/src/assert.js";
import {isUncheckedError, PermissionsError} from "/src/errors.js";
import {showNotification} from "/src/extension.js";
import FaviconCache from "/src/favicon-cache.js";
import FaviconLookup from "/src/favicon-lookup.js";
import {
  feedCreateIconLookupURL,
  feedHasURL,
  feedIsFeed,
  feedIsValidId,
  feedMerge,
  feedPeekURL
} from "/src/feed.js";
import {fetchFeed} from "/src/fetch.js";
import isAllowedURL from "/src/fetch-policy.js";
import {isOpenDB} from "/src/idb.js";
import {readerBadgeUpdate} from "/src/reader-badge.js";
import {
  close as readerDbClose,
  open as readerDbOpen,
  readerDbIsOpen,
  readerDbFindFeedIdByURL,
  readerDbFindEntryIdsByFeedId,
  readerDbRemoveFeedAndEntries,
  ConstraintError as ReaderDbConstraintError
} from "/src/rdb.js";
import {readerParseFeed} from "/src/reader-parse-feed.js";
import {readerStoragePutFeed} from "/src/reader-storage.js";


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
    const promises = [readerDbOpen(), this.iconCache.open()];
    [this.readerConn, _] = await Promise.all(promises);
  }

  // Close database connections
  close() {
    if(this.iconCache) {
      this.iconCache.close();
    }

    readerDbClose(this.readerConn);
  }

  // Returns a promise that resolves to the id of a feed matching the url
  isSubscribed(url) {
    return readerDbFindFeedIdByURL(this.readerConn, url);
  }

  // @param feed {Object} the feed to subscribe to
  // @throws {AssertionError}
  // @throws {Error} database-related
  // @throws {Error} parse related
  // @throws {Error} fetch related
  // @returns {Object} the subscribed feed
  async subscribe(feed) {
    assert(readerDbIsOpen(this.readerConn));
    assert(this.iconCache instanceof FaviconCache);
    assert(isOpenDB(this.iconCache.conn));
    assert(feedIsFeed(feed));
    assert(feedHasURL(feed));

    const url = feedPeekURL(feed);

    if(!isAllowedURL(url)) {
      throw new PermissionsError(url + ' is not permitted');
    }

    if(await this.isSubscribed(url)) {
      throw new ReaderDbConstraintError();
    }

    if(navigator.onLine || !('onLine' in navigator)) {
      const res = await fetchFeed(url, this.timeoutMs);
      if(res.redirected) {
        if(await this.isSubscribed(res.responseURL)) {
          throw new ReaderDbConstraintError();
        }
      }

      const xml = await res.text();
      const PROCESS_ENTRIES = false;
      const parseResult = readerParseFeed(xml, url, res.responseURL, res.lastModifiedDate,
        PROCESS_ENTRIES);
      const mergedFeed = feedMerge(feed, parseResult.feed);
      feed = mergedFeed;
    }

    await this.setFavicon(feed);
    const storedFeed = await this.addFeed(feed);
    this.showNotification(storedFeed);
    return storedFeed;
  }

  async addFeed(feed) {
    const SKIP_PREP = false;
    const storedFeed = await readerStoragePutFeed(feed, this.readerConn, SKIP_PREP);
    return storedFeed;
  }

  showNotification(feed) {
    if(!this.notify) {
      return;
    }

    const title = 'Subscribed';
    const feedName = feed.title || feedPeekURL(feed);
    const message = 'Subscribed to ' + feedName;
    showNotification(title, message, feed.faviconURLString);
  }

  async setFavicon(feed) {
    const query = new FaviconLookup();
    query.cache = this.iconCache;
    query.skipURLFetch = true;
    const url = feedCreateIconLookupURL(feed);
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

  // TODO: deprecate
  // TODO: use promiseEvery?
  // Concurrently subscribe to each feed
  subscribeAll(feeds) {
    const promises = feeds.map(this.subscribe);
    return Promise.all(promises);
  }

  // @throws AssertionError
  // @throws Error database-related
  async remove(feedId) {
    assert(readerDbIsOpen(this.readerConn));
    assert(feedIsValidId(feedId));
    const entryIds = await readerDbFindEntryIdsByFeedId(this.readerConn, feedId);
    await readerDbRemoveFeedAndEntries(this.readerConn, feedId, entryIds);
    await readerBadgeUpdate(this.readerConn);
    const channel = new BroadcastChannel('db');
    channel.postMessage({type: 'feed-deleted', id: feedId});
    for(const entryId of entryIds) {
      channel.postMessage({type: 'entry-deleted', id: entryId});
    }
    channel.close();
  }
}
