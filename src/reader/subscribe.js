import assert from "/src/utils/assert.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import {ConstraintError} from "/src/feed-store/errors.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {OfflineError} from "/src/fetch/errors.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import parseFeed from "/src/reader/parse-feed.js";
import {showNotification} from "/src/platform/platform.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import {setTimeoutPromise} from "/src/utils/promise-utils.js";
import formatString from "/src/utils/format-string.js";

// TODO: think of a better name

export default function Subscribe() {
  this.feedStore;
  this.iconCache;
  this.fetchFeedTimeoutMs = 2000;
  this.concurrent = false;
  this.notify = true;

  // Accept these additional mime types when fetching a feed by default
  this.extendedFeedTypes = [
    'text/html',
    'application/octet-stream'
  ];
}

Subscribe.prototype.init = function() {
  this.feedStore = new FeedStore();
  this.iconCache = new FaviconCache();
};

Subscribe.prototype.connect = async function() {
  assert(this.feedStore instanceof FeedStore);
  assert(this.iconCache instanceof FaviconCache);

  // TODO: assert not open

  const promises = [this.feedStore.open(), this.iconCache.open()];
  await Promise.all(promises);
};

Subscribe.prototype.close = function() {
  if(this.feedStore) {
    this.feedStore.close();
  }

  if(this.iconCache) {
    this.iconCache.close();
  }
};

// TODO: currently the redirect url is not validated as to whether it is a fetchable
// url according to the app's fetch policy. It is just assumed. I am not quite sure what to
// do about it at the moment. Maybe I could create a second policy that controls what urls
// are allowed by the app to be stored in the database? Or maybe I should just call
// isAllowedURL here explicitly?

// @param url {URL} the url of the feed to subscribe to
// @returns {Object} the subscribed feed
Subscribe.prototype.subscribe = async function(url) {
  assert(this.feedStore instanceof FeedStore);
  assert(this.feedStore.isOpen());
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(url instanceof URL);
  console.debug('subscribe start', url.href);

  await this.checkFeedURLConstraint(url);
  const response = await this.fetchFeed(url);
  let feed;
  if(response) {
    if(response.redirected) {
      url = new URL(response.responseURL);
      await this.checkFeedURLConstraint(url);
    }

    const xml = await response.text();
    const kProcEntries = false;
    const parseResult = parseFeed(xml, url.href, response.responseURL,
      response.lastModifiedDate, kProcEntries);
    feed = parseResult.feed;
  } else {
    // We take care to create the feed using the factory method instead of creating a simple
    // object, because the factory method sets some hidden properties.
    feed = Feed.create();
    feed.appendURL(url.href);
  }

  assert(Feed.isFeed(feed));
  await this.setFeedFavicon(feed);
  const storableFeed = await this.saveFeed(feed);
  this.showNotification(storableFeed);
  // Call non-awaited to allow for subscribe to settle
  if(!this.concurrent) {
    deferredPollFeed(storableFeed).catch(console.warn);
  }
  return storableFeed;
};

Subscribe.prototype.checkFeedURLConstraint = async function(url) {
  let feedExists = await this.feedStore.containsFeedWithURL(url);
  if(feedExists) {
    const message = formatString('Already subscribed to feed with url', url.href);
    throw new ConstraintError(message);
  }
};

// Returns a defined response when successful, an undefined response when offline, or an error if
// there was a problem with fetching while online or a programming error.
Subscribe.prototype.fetchFeed = async function(url) {
  let response;
  try {
    response = await fetchFeed(url, this.fetchFeedTimeoutMs, this.extendedFeedTypes);
  } catch(error) {
    if(error instanceof OfflineError) {
      // fall through
    } else {
      // either assertion failure or fetch error
      throw error;
    }
  }
  return response;
};

Subscribe.prototype.setFeedFavicon = async function(feed) {
  assert(Feed.isFeed(feed));

  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  const lookupURL = Feed.createIconLookupURL(feed);
  try {
    const iconURLString = await query.lookup(lookupURL);
    if(iconURLString) {
      feed.faviconURLString = iconURLString;
    }
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    }
  }
};

Subscribe.prototype.saveFeed = async function(feed) {
  const storableFeed = this.feedStore.prepareFeed(feed);
  storableFeed.active = true;
  storableFeed.dateCreated = new Date();
  const newFeedId = await this.feedStore.putFeed(feed);
  storableFeed.id = newFeedId;
  return storableFeed;
};

// TODO: reconsider how this.notify overlaps with this.concurrent
Subscribe.prototype.showNotification = function(feed) {
  if(this.notify) {
    const title = 'Subscribed!';
    const feedName = feed.title || Feed.peekURL(feed);
    const message = 'Subscribed to ' + feedName;
    showNotification(title, message, feed.faviconURLString);
  }
};


// Returns a promise that resolves after the given number of milliseconds
function sleep(ms) {
  const [timer, timeoutPromise] = setTimeoutPromise(ms);
  return timeoutPromise;
}

async function deferredPollFeed(feed) {
  await sleep(500);

  const poll = new FeedPoll();
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
