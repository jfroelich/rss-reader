'use strict';

// import base/assert.js
// import base/indexeddb.js
// import base/object.js
// import net/fetch.js
// import feed-coerce-from-response.js
// import feed.js
// import extension.js
// import favicon.js
// import reader-db.js
// import reader-badge.js

class SubscribeRequest {
  constructor() {
    this.readerConn = undefined;
    this.iconConn = undefined;
    this.timeoutMs = 2000;
    this.notify = true;
  }

  // Open database connections
  async connect() {
    const connPromises = [readerDbOpen(), faviconDbOpen()];
    [this.readerConn, this.iconConn] = await Promise.all(connPromises);
  }

  // Close database connections
  close() {
    indexedDBClose(this.readerConn, this.iconConn);
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
    assert(indexedDBIsOpen(this.readerConn));
    assert(indexedDBIsOpen(this.iconConn));
    assert(feedIsFeed(feed));
    assert(feedHasURL(feed));

    const url = feedPeekURL(feed);
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

      const xml = await response.text();
      const PROCESS_ENTRIES = false;
      const parseResult = readerParseFeed(xml, url, res.responseURL,
        res.lastModifiedDate, PROCESS_ENTRIES);
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
    const storedFeed = await readerStoragePutFeed(feed, this.readerConn,
      SKIP_PREP);
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
    const query = new FaviconQuery();
    query.conn = this.iconConn;
    query.url = feedCreateIconLookupURL(feed);
    query.skipURLFetch = true;
    try {
      const iconURL = await faviconLookup(query);
      feed.faviconURLString = iconURL;
    } catch(error) {
      if(error instanceof AssertionError) {
        throw error;
      } else {
        // ignore, favicon failure is non-fatal
      }
    }
  }
}

// TODO: make a member of SubscribeRequest, like subscribeAll
// Concurrently subscribe to each feed in the feeds iterable. Returns a promise
// that resolves to an array of statuses. If a subscription fails due
// to an error, that subscription and all later subscriptions are ignored,
// but earlier ones are committed. If a subscription fails but not for an
// exceptional reason, then it is skipped.
// @param this {SubscriptionContext}
function subscriptionAddAll(feeds) {
  const request = new SubscribeRequest();
  this.readerConn = this.readerConn;
  this.iconConn = this.iconConn;
  this.timeoutMs = this.timeoutMs;
  this.notify = this.notify;

  const promises = [];
  for(const feed of feeds) {
    promises.push(request.subscribe(feed));
  }
  // TODO: use promiseEvery?
  return Promise.all(promises);
}

// @throws AssertionError
// @throws Error database-related
async function subscriptionRemove(feed, conn) {

  assert(indexedDBIsOpen(conn));
  assert(feedIsFeed(feed));
  assert(feedIsValidId(feed.id));

  const entryIds = await readerDbFindEntryIdsByFeedId(conn, feed.id);
  await readerDbRemoveFeedAndEntries(conn, feed.id, entryIds);
  await readerUpdateBadge(conn);
  const channel = new BroadcastChannel('db');
  channel.postMessage({type: 'feed-deleted', id: feed.id});
  for(const entryId of entryIds) {
    channel.postMessage({type: 'entry-deleted', id: entryId});
  }
  channel.close();
}
