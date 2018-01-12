import showDesktopNotification from "/src/notifications.js";
import assert from "/src/common/assert.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import formatString from "/src/common/format-string.js";
import {setTimeoutPromise} from "/src/common/promise-utils.js";
import * as Status from "/src/common/status.js";
import {FaviconCache, FaviconService} from "/src/favicon-service/favicon-service.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import {ConstraintError} from "/src/feed-store/errors.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import parseFeed from "/src/parse-feed.js";

// TODO: think of a better name

export default function Subscribe() {
  this.feedStore;
  this.iconCache;
  this.fetchFeedTimeoutMs = 2000;
  this.concurrent = false;
  this.notify = true;
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

  console.log('Subscribing to', url.href);

  let status;
  let containsFeed;

  [status, containsFeed] = await this.feedStore.containsFeedWithURL(url);
  if(status !== Status.OK) {
    console.error('Failed to check if feed with url exists, status is', status);
    return [status];
  }

  if(containsFeed) {
    console.debug('Already subscribed to feed with url', url);
    return [Status.EDBCONSTRAINT];
  }

  let response;
  [status, response] = await FetchUtils.fetchFeed(url, this.fetchFeedTimeoutMs);
  if(status === Status.EOFFLINE) {
    // Continue with offline subscription and undefined response
  } else if(status !== Status.OK) {
    return [status];
  }

  let feed;
  if(response) {
    const responseURLObject = new URL(response.url);
    if(FetchUtils.detectURLChanged(url, responseURLObject)) {
      url = responseURLObject;
      [status, containsFeed] = await this.feedStore.containsFeedWithURL(url);
      if(status !== Status.OK) {
        console.error('Failed to check if feed with url exists, status is', status);
        return [status];
      }

      if(containsFeed) {
        console.debug('Already subscribed to redirect url', url);
        return [Status.EDBCONSTRAINT];
      }
    }

    let responseText;
    try {
      responseText = await response.text();
    } catch(error) {
      console.warn(error);
      return [Status.EFETCH];
    }

    const kProcEntries = false;

    let parseResult;
    [status, parseResult] = parseFeed(responseText, url, responseURLObject,
      FetchUtils.getLastModified(response), kProcEntries);
    if(status !== Status.OK) {
      console.error('Parse feed error:', Status.toString(status));
      return [status];
    }

    feed = parseResult.feed;
  } else {
    feed = Feed.create();
    Feed.appendURL(feed, url);
  }

  await this.setFeedFavicon(feed);
  const storableFeed = await this.saveFeed(feed);
  this.showNotification(storableFeed);
  // Call non-awaited to allow for subscribe to settle
  if(!this.concurrent) {
    deferredPollFeed(storableFeed).catch(console.warn);
  }
  return [Status.OK, storableFeed];
};



Subscribe.prototype.setFeedFavicon = async function(feed) {
  if(!Feed.isFeed(feed)) {
    console.error('Invalid feed argument', feed);
    return Status.EINVAL;
  }

  const query = new FaviconService();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  const lookupURL = Feed.createIconLookupURL(feed);

  const [status, iconURLString] = await query.lookup(lookupURL);
  if(status !== Status.OK) {
    console.error('Favicon lookup error:', Status.toString(status));
    return status;
  }

  if(iconURLString) {
    feed.faviconURLString = iconURLString;
  }
};

Subscribe.prototype.saveFeed = async function(feed) {
  const storableFeed = this.feedStore.prepareFeed(feed);
  storableFeed.active = true;
  storableFeed.dateCreated = new Date();
  const [status, newFeedId] = await this.feedStore.putFeed(feed);
  if(status !== Status.OK) {
    throw new Error('Failed to put feed with status ' + status);
  }

  storableFeed.id = newFeedId;
  return storableFeed;
};

// TODO: reconsider how this.notify overlaps with this.concurrent
Subscribe.prototype.showNotification = function(feed) {
  if(this.notify) {
    const title = 'Subscribed!';
    const feedName = feed.title || Feed.peekURL(feed);
    const message = 'Subscribed to ' + feedName;
    showDesktopNotification(title, message, feed.faviconURLString);
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
