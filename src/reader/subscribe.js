import assert from "/src/assert/assert.js";
import {showNotification} from "/src/platform/platform.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import PollFeeds from "/src/feed-poll/poll-feeds.js";
import {ConstraintError} from "/src/feed-store/errors.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {OfflineError} from "/src/fetch/errors.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import parseFeed from "/src/reader/parse-feed.js";
import * as Feed from "/src/feed-store/feed.js";
import check from "/src/utils/check.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import {setTimeoutPromise} from "/src/utils/promise-utils.js";
import {setURLHrefProperty} from "/src/utils/url-utils.js";

// Module for subscribing to a new feed
// TODO: Context is silly, just use an object


export function Context() {
  /* FeedStore */ this.feedStore;
  /* FaviconCache */ this.iconCache;

  this.fetchFeedTimeoutMs = 2000;
  this.concurrent = false;
  this.notify = true;

  // Accept these additional mime types when fetching a feed by default
  this.extendedFeedTypes = [
    'text/html',
    'application/octet-stream'
  ];
}

// Opens database connections
Context.prototype.connect = async function() {

  // TODO: these belong in an init helper
  this.feedStore = new FeedStore();
  this.iconCache = new FaviconCache();

  const promises = [this.feedStore.open(), this.iconCache.open()];
  await Promise.all(promises);
};

// Closes database connections
Context.prototype.close = function() {
  if(this.feedStore) {
    this.feedStore.close();
  }

  if(this.iconCache) {
    this.iconCache.close();
  }
};

// @param this {Context}
// @param feed {Object} the feed to subscribe to
// @returns {Object} the subscribed feed
export async function subscribe(feed) {
  assert(this instanceof Context);
  assert(this.feedStore instanceof FeedStore);
  assert(this.feedStore.isOpen());
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const feedURLString = Feed.peekURL(feed);

  console.debug('Subscribing to feed with url', feedURLString);

  // Convert the url string into a URL object. This implicitly validates that the url is valid,
  // and canonical.
  const urlObject = new URL(feedURLString);

  // Check that user is not already subscribed
  let priorFeedId = await this.feedStore.findFeedIdByURL(feedURLString);
  check(!Feed.isValidId(priorFeedId), ConstraintError, 'Already subscribed to feed with url',
    feedURLString);

  // Fetch the feed
  let response;
  try {
    response = await fetchFeed(urlObject, this.fetchFeedTimeoutMs, this.extendedFeedTypes);
  } catch(error) {
    if(isUncheckedError(error)) {
      // Fetch failed because of a programmer error, rethrow
      throw error;
    } else if(error instanceof OfflineError) {
      // Fetch failed because it appears we are offline
      // Fall through, proceed with offline subscription
    } else {
      // We are online, and fetch failed, treat as a fatal error and rethrow
      throw error;
    }
  }

  // response may be undefined in the case of an offline error
  if(response) {
    if(response.redirected) {

      // TODO: this change may no longer be needed due to 418, I think the variable is no longer
      // in use? Ok, looked, it is not in use currently. However, I noticed that I am still
      // passing url later to parseFeed, which maybe I should be passing urlObject, after it was
      // modified here.
      setURLHrefProperty(urlObject, response.responseURL);

      // TODO: currently the redirect url is not validated as to whether it is a fetchable
      // url according to the app's fetch policy. It is just assumed. I am not quite sure what to
      // do about it at the moment. Maybe I could create a second policy that controls what urls
      // are allowed by the app to be stored in the database? Or maybe I should just call
      // isAllowedURL here explicitly?

      // Check that user is not already subscribed now that we know redirect
      priorFeedId = await this.feedStore.findFeedIdByURL(response.responseURL);
      check(!Feed.isValidId(priorFeedId), ConstraintError, 'already subscribed');
    }

    // Get the full response body in preparation for parsing
    const xml = await response.text();

    // TODO: I just realized that the call to parseFeed is using feedURLString, and am not sure that
    // is correct. Do I want to actually be using response.responseURL instead? It depends on how
    // the second parameter/argument is used by parseFeed, which I do not know at the moment,
    // because I forgot. So, go and determine how parseFeed is using the url. If I should be
    // using the response url, make sure I use urlObject, not feedURLString, and leave in the
    // modification to urlObject above.

    // Do not process or store entries when subscribing. Only store the feed.
    const kProcEntries = false;
    const parseResult = parseFeed(xml, feedURLString, response.responseURL,
      response.lastModifiedDate, kProcEntries);
    feed = Feed.merge(feed, parseResult.feed);
  }

  // Set the feed's favicon, regardless of connectivity state.
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

  const storableFeed = this.feedStore.prepareFeed(feed);
  storableFeed.active = true;// active by default
  storableFeed.dateCreated = new Date();
  const newFeedId = await this.feedStore.putFeed(feed);
  storableFeed.id = newFeedId;
  const storedFeed = storableFeed;

  // Show a notification for the successful subscription. If calling concurrently the caller
  // should separately set notify to false to disable this.
  // TODO: reconsider how this.notify overlaps with this.concurrent
  if(this.notify) {
    const title = 'Subscribed';
    const feedName = storedFeed.title || Feed.peekURL(storedFeed);
    const message = 'Subscribed to ' + feedName;
    showNotification(title, message, storedFeed.faviconURLString);
  }

  // Call non-awaited to allow for subscribe to settle before deferredPollFeed settles. This is
  // basically a fork. This only happens when calling non-concurrently.
  // This cannot share resources like database connection with subscribe, because subscribe can
  // settle prior to this completing, and callers can freely close connection used by subscribe
  // once it settles.
  if(!this.concurrent) {
    // Because we are returning before this completes, this cannot throw an error, or rather,
    // there is nothing we can do about the error
    deferredPollFeed(storedFeed).catch(console.warn);
  }

  return storedFeed;
}

// Returns a promise that resolves after the given number of milliseconds
function sleep(ms) {
  const [timer, timeoutPromise] = setTimeoutPromise(ms);
  return timeoutPromise;
}

async function deferredPollFeed(feed) {
  await sleep(500);

  const poll = new PollFeeds();
  poll.init();

  // We just fetched the feed. We definitely want to be able to process its entries, so disable
  // these checks because they most likely fail.
  poll.ignoreRecencyCheck = true;
  poll.ignoreModifiedCheck = true;

  // NOTE: this relies on the default extended accepted feed mime types rather than explicitly
  // configuring them here. Keep in mind this may be different than the explicitly specified types
  // in the subscribe function. Generally the two should be the same but this isn't guaranteed.

  // TODO: should this actually throw instead of trapping error? But it is forked and caller
  // already returned, so what happens?

  const batched = false;
  try {
    await poll.open();
    await poll.pollFeed(feed, batched);
  } catch(error) {
    console.warn(error);
  } finally {
    poll.close();
  }
}
