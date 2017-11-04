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

function SubscriptionContext() {
  this.readerConn;
  this.iconConn;
  this.timeoutMs = 2000;
  this.notify = true;
}

// Returns the subscribed feed is successful, otherwise undefined.
// @throws AssertionError
// @throws Error database-related
// @throws Error parse related
// @throws Error fetch related
async function subscriptionAdd(feed) {
  console.log('subscriptionAdd', feed);
  assert(this instanceof SubscriptionContext);
  assert(indexedDBIsOpen(this.readerConn));
  assert(indexedDBIsOpen(this.iconConn));
  assert(feedIsFeed(feed));

  if(!feedHasURL(feed)) {
    // TODO: use more specific error
    throw new Error('feed missing url');
  }

  const urlString = feedPeekURL(feed);
  if(!(await subscriptionIsUnique(urlString, this.readerConn))) {
    throw new Error('constraint error');
  }

  // If offline then skip fetching information.
  // TODO: maybe should not support subscribe while offline if I have no way
  // of removing dead or invalid feeds
  if('onLine' in navigator && !navigator.onLine) {
    // Skip the favicon lookup while offline
    // TODO: maybe should not skip favicon lookup if cache-only lookup could
    // still work
    return await subscriptionPutFeed(feed, this.readerConn, this.notify);
  }

  // Allow errors to bubble
  const response = await fetchFeed(urlString, this.timeoutMs);

  if(response.redirected) {
    if(!(await subscriptionIsUnique(response.responseURL, this.readerConn))) {
      throw new Error('constraint error');
    }
  }

  // Allow errors to bubble
  const feedXML = await response.text();

  const PROCESS_ENTRIES = false;

  // Allow errors to bubble
  const parseResult = readerParseFeed(feedXML, response.request_url,
    response.responseURL, response.last_modified_date, PROCESS_ENTRIES);


  const mergedFeed = feedMerge(feed, parseResult.feed);

  try {
    await feedUpdateFavicon(mergedFeed, this.iconConn);
  } catch(error) {
    if(error instanceof AssertionError) {
      throw error;
    } else {
      // ignore, favicon failure is non-fatal
    }
  }

  return await subscriptionPutFeed(mergedFeed, this.readerConn, this.notify);
}

// Check whether a feed with the given url already exists in the database
// @throws {Error} database-related
async function subscriptionIsUnique(urlString, readerConn) {
  const feed = await readerDbFindFeedIdByURL(readerConn, urlString);
  return !feed;
}

// TODO: deprecate, this should delegate to readerStoragePutFeed instead
// I think first step would be to inline this function, because right now it
// composes prep, store, and notify together.
// TODO: The second problem is the notify flag. Basically, let the caller decide
// @throws AssertionError
// @throws Error database related
// @throws Error feed related
async function subscriptionPutFeed(feed, readerConn, notify) {
  // Prep
  let storableFeed = feedSanitize(feed);
  storableFeed = objectFilterEmptyProps(storableFeed);
  storableFeed.dateCreated = new Date();

  // Store
  // Allow errors to bubble
  const newId = await readerDbPutFeed(readerConn, storableFeed);
  storableFeed.id = newId;

  // Notify
  if(notify) {
    const title = 'Subscribed';
    const feedName = storableFeed.title || feedPeekURL(storableFeed);
    const message = 'Subscribed to ' + feedName;
    extensionNotify(title, message, storableFeed.faviconURLString);
  }
  return storableFeed;
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

  // Allow errors to bubble
  let entryIds = await readerDbFindEntryIdsByFeedId(this.readerConn, feed.id);
  // Allow errors to bubble
  await readerDbRemoveFeedAndEntries(this.readerConn, feed.id, entryIds);
  // Allow errors to bubble
  await readerUpdateBadge(this.readerConn);

  const channel = new BroadcastChannel('db');
  channel.postMessage({type: 'feed-deleted', id: feed.id});
  for(const entryId of entryIds) {
    channel.postMessage({type: 'entry-deleted', id: entryId});
  }
  channel.close();
}
