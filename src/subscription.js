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

// Returns a result object with properties status and feed. feed is only defined
// if status is ok. feed is a copy of the inserted feed, which includes its new
// id.
async function subscriptionAdd(feed) {
  console.log('subscriptionAdd', feed);
  assert(this instanceof SubscriptionContext);
  assert(indexedDBIsOpen(this.readerConn));
  assert(indexedDBIsOpen(this.iconConn));
  assert(feedIsFeed(feed));

  if(!feedHasURL(feed)) {
    return {'status' : RDR_EINVAL};
  }

  const urlString = feedGetTopURL(feed);
  let status = await subscriptionIsUnique(urlString, this.readerConn);
  if(status !== RDR_OK) {
    return {'status' : status};
  }

  // If offline then skip fetching information.
  // TODO: maybe should not support subscribe while offline if I have no way
  // of removing dead or invalid feeds yet

  // Skip the favicon lookup while offline
  // TODO: maybe should not skip favicon lookup if cache-only lookup could
  // still work

  if('onLine' in navigator && !navigator.onLine) {
    return await subscriptionPutFeed(feed, this.readerConn, this.notify);
  }

  let response;
  try {
    response = await fetchFeed(urlString, this.timeoutMs);
  } catch(error) {
    // If we are online and fetch fails then cancel the subscription
    console.warn(error);
    return {'status': RDR_ERR_FETCH};
  }

  if(response.redirected) {
    status = await subscriptionIsUnique(response.responseURL, this.readerConn);
    if(status !== RDR_OK) {
      return {'status' : status};
    }
  }

  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    console.warn(error);
    return RDR_ERR_FETCH;
  }

  const PROCESS_ENTRIES = false;
  const parseResult = readerParseFeed(feedXML, response.request_url,
    response.responseURL, response.last_modified_date, PROCESS_ENTRIES);
  if(parseResult.status !== RDR_OK) {
    return {'status': parseResult.status};
  }

  const mergedFeed = feedMerge(feed, parseResult.feed);
  status = await feedUpdateFavicon(mergedFeed, this.iconConn);
  if(status !== RDR_OK) {
    console.debug('failed to update feed favicon (non-fatal)', status);
  }

  return await subscriptionPutFeed(mergedFeed, this.readerConn, this.notify);
}

// Check whether a feed with the given url already exists in the database
// Return the status. Return ok if not already exists. Otherwise, returns either
// database error or constraint error.
async function subscriptionIsUnique(urlString, readerConn) {
  let feed;
  try {
    feed = await readerDbFindFeedIdByURL(readerConn, urlString);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }
  return feed ? RDR_ERR_CONSTRAINT : RDR_OK;
}

// TODO: this should delegate to readerStoragePutFeed instead
// and subscriptionFeedPrep should be deprecated as well
// I think first step would be to inline this function, because right now it
// composes prep, store, and notify together.
// The second problem is the notify flag. Basically, let the caller decide
// whether to notify simply by choosing to call subscriptionNotifyAdd or not.
// The notify flag is pointless here and also in subscriptionNotifyAdd
async function subscriptionPutFeed(feed, readerConn, notify) {
  const storableFeed = subscriptionFeedPrep(feed);
  let newId;
  try {
    newId = await readerDbPutFeed(readerConn, storableFeed);
  } catch(error) {
    console.warn(error);
    return {'status': RDR_ERR_DB};
  }

  storableFeed.id = newId;
  if(notify) {
    subscriptionNotifyAdd(storableFeed);
  }

  return {'status': RDR_OK, 'feed': storableFeed};
}

function subscriptionNotifyAdd(feed) {
  const title = 'Subscribed';
  const feedName = feed.title || feedGetTopURL(feed);
  const message = 'Subscribed to ' + feedName;
  extensionNotify(title, message, feed.faviconURLString);
}

// Creates a shallow copy of the input feed suitable for storage
function subscriptionFeedPrep(feed) {
  let storable = feedSanitize(feed);
  storable = objectFilterEmptyProps(storable);
  storable.dateCreated = new Date();
  return storable;
}

// Concurrently subscribe to each feed in the feeds iterable. Returns a promise
// that resolves to an array of statuses. If a subscription fails due
// to an error, that subscription and all later subscriptions are ignored,
// but earlier ones are committed. If a subscription fails but not for an
// exceptional reason, then it is skipped.
function subscriptionAddAll(feeds) {
  return Promise.all(feeds.map(subscriptionAdd, this));
}

async function subscriptionRemove(feed) {
  assert(this instanceof SubscriptionContext);
  assert(indexedDBIsOpen(this.readerConn));
  assert(feedIsFeed(feed));
  assert(feedIsValidId(feed.id));

  console.log('subscriptionRemove id', feed.id);

  let entryIds;
  try {
    entryIds = await readerDbFindEntryIdsByFeedId(this.readerConn, feed.id);
    await readerDbRemoveFeedAndEntries(this.readerConn, feed.id, entryIds);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  // ignore status
  await readerUpdateBadge(this.readerConn);

  const channel = new BroadcastChannel('db');
  channel.postMessage({'type': 'feed-deleted', 'id': feed.id});
  for(const entryId of entryIds) {
    channel.postMessage({'type': 'entry-deleted', 'id': entryId});
  }
  channel.close();

  console.debug('unsubscribed from feed', feed.id);
  return RDR_OK;
}
