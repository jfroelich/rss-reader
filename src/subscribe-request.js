'use strict';

// import extension.js
// import favicon-cache.js
// import favicon-lookup.js
// import feed.js
// import fetch.js
// import fetch-policy.js
// import rbl.js
// import reader-db.js
// import reader-badge.js
// import reader-parse-feed.js
// import reader-storage.js

// TODO: write member functions out of line so it is more readable, I hate this class syntax, it
// is too symptomatic of trying to overly condense things to the point where intent is obfuscated


class SubscribeRequest {
  constructor() {

    this.iconCache = undefined;
    this.readerConn = undefined;
    //this.iconConn = undefined;
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

    closeDB(this.readerConn);
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
    assert(isOpenDB(this.readerConn));
    assert(this.iconCache instanceof FaviconCache);
    assert(feedIsFeed(feed));
    assert(feedHasURL(feed));

    const url = feedPeekURL(feed);

    if(!FetchPolicy.isAllowedURL(url)) {
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
    extensionNotify(title, message, feed.faviconURLString);
  }

  async setFavicon(feed) {
    const query = new FaviconLookup();

    // TODO: the containing object should have a cache member instead of doing this, this
    // violates law of demeter and is rather hackish. However I quickly refactored and just want
    // to get it working for now.
    query.cache = new FaviconCache();
    query.cache.conn = this.iconConn;

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
  // Concurrently subscribe to each feed
  subscribeAll(feeds) {
    const promises = feeds.map(this.subscribe);
    // TODO: use promiseEvery?
    return Promise.all(promises);
  }

  // @throws AssertionError
  // @throws Error database-related
  async remove(feedId) {
    assert(isOpenDB(this.readerConn));
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
