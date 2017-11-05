'use strict';

// import base/assert.js
// import base/object.js
// import net/fetch.js
// import feed-coerce-from-response.js
// import feed.js
// import extension.js
// import favicon.js
// import reader-db.js
// import reader-badge.js


// TODO: make subscriptionAdd a member of SubscriptionContext, rename
// SubscriptionContext to SubscribeRequest or something like that.

function SubscriptionContext() {
  this.readerConn;
  this.iconConn;
  this.timeoutMs = 2000;
  this.notify = true;
}

// @param feed {Object} the feed to subscribe to
// @param this {SubscriptionContext}
// @throws {AssertionError}
// @throws {Error} database-related
// @throws {Error} parse related
// @throws {Error} fetch related
// @returns {Object} the subscribed feed
async function subscriptionAdd(feed) {
  console.log('subscriptionAdd', feed);
  assert(this instanceof SubscriptionContext);
  assert(indexedDBIsOpen(this.readerConn));
  assert(indexedDBIsOpen(this.iconConn));
  assert(feedIsFeed(feed));
  assert(feedHasURL(feed));

  const url = feedPeekURL(feed);
  if(await readerDbFindFeedIdByURL(this.readerConn, url)) {
    throw new ReaderDbConstraintError();
  }

  // If we are online, or cannot tell, then try and fetch the feed's details,
  // check if it exists, and check for redirect url.
  if(navigator.onLine || !('onLine' in navigator)) {
    const res = await fetchFeed(url, this.timeoutMs);
    if(res.redirected) {
      if(await readerDbFindFeedIdByURL(this.readerConn,res.responseURL)) {
        throw new ReaderDbConstraintError();
      }
    }

    const xml = await response.text();
    const PROCESS_ENTRIES = false;
    const parseResult = readerParseFeed(xml, url, res.responseURL,
      res.last_modified_date, PROCESS_ENTRIES);
    const mergedFeed = feedMerge(feed, parseResult.feed);
    feed = mergedFeed;
  }

  await subscriptionLookupFavicon.call(this, feed);

  const SKIP_PREP = false;
  const storedFeed = readerStoragePutFeed(feed, this.readerConn, SKIP_PREP);
  if(this.notify) {
    subscriptionNotify(storedFeed);
  }
  return storedFeed;
}

async function subscriptionLookupFavicon(feed) {
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

function subscriptionNotify(feed) {
  const title = 'Subscribed';
  const feedName = feed.title || feedPeekURL(feed);
  const message = 'Subscribed to ' + feedName;
  extensionNotify(title, message, feed.faviconURLString);
}

// Concurrently subscribe to each feed in the feeds iterable. Returns a promise
// that resolves to an array of statuses. If a subscription fails due
// to an error, that subscription and all later subscriptions are ignored,
// but earlier ones are committed. If a subscription fails but not for an
// exceptional reason, then it is skipped.
// @param this {SubscriptionContext}
function subscriptionAddAll(feeds) {
  return Promise.all(feeds.map(subscriptionAdd, this));
}

// @throws AssertionError
// @throws Error database-related
async function subscriptionRemove(feed) {
  assert(this instanceof SubscriptionContext);
  assert(indexedDBIsOpen(this.readerConn));
  assert(feedIsFeed(feed));
  assert(feedIsValidId(feed.id));

  const entryIds = await readerDbFindEntryIdsByFeedId(this.readerConn, feed.id);
  await readerDbRemoveFeedAndEntries(this.readerConn, feed.id, entryIds);
  await readerUpdateBadge(this.readerConn);
  const channel = new BroadcastChannel('db');
  channel.postMessage({type: 'feed-deleted', id: feed.id});
  for(const entryId of entryIds) {
    channel.postMessage({type: 'entry-deleted', id: entryId});
  }
  channel.close();
}
