import showDesktopNotification from "/src/notifications.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import * as Status from "/src/common/status.js";
import {FaviconCache, FaviconService} from "/src/favicon-service/favicon-service.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import coerceFeed from "/src/coerce-feed.js";

// TODO: currently the redirect url is not validated as to whether it is a fetchable
// url according to the app's fetch policy. It is just assumed. I am not quite sure what to
// do about it at the moment. Maybe I could create a second policy that controls what urls
// are allowed by the app to be stored in the database? Or maybe I should just call
// isAllowedURL here explicitly?
// TODO: reconsider how notify overlaps with concurrent. For that matter, concurrent is a bit
// to abstract and should probably be renamed to something more granular and specific to
// what it does, like enqueuePoll
// TODO: notify a channel of feed created

// context properties:
// feedStore, database conn
// iconCache, database conn
// fetchFeedTimeoutMs, integer, optional
// concurrent, boolean, optional, whether called concurrently
// notify, boolean, optional, whether to notify


export default async function subscribe(context, url) {
  if(typeof context !== 'object') {
    return [Status.EINVAL];
  }

  if(!(context.feedStore instanceof FeedStore)) {
    return [Status.EINVAL];
  }

  if(!(context.iconCache instanceof FaviconCache)) {
    return [Status.EINVAL];
  }

  if(!context.feedStore.isOpen()) {
    return [Status.EINVALIDSTATE];
  }

  if(!context.iconCache.isOpen()) {
    return [Status.EINVALIDSTATE];
  }

  if(!(url instanceof URL)) {
    return [Status.EINVAL];
  }

  if(!('concurrent' in context)) {
    context.concurrent = false;
  }

  if(!('notify' in context)) {
    context.notify = true;
  }

  if(!('fetchFeedTimeoutMs' in context)) {
    context.fetchFeedTimeoutMs = 2000;
  }

  console.log('Subscribing to', url.href);

  let [status, containsFeed] = await context.feedStore.containsFeedWithURL(url);
  if(status !== Status.OK) {
    console.error('Database error:', Status.toString(status));
    return [status];
  }

  if(containsFeed) {
    console.debug('Already subscribed to', url.href);
    return [Status.EDBCONSTRAINT];
  }

  let response;
  [status, response] = await FetchUtils.fetchFeed(url, context.fetchFeedTimeoutMs);
  if(status === Status.EOFFLINE) {
    // Continue with offline subscription
    console.debug('Subscribing while offline to', url.href);
  } else if(status !== Status.OK) {
    console.error('Fetch feed error:', url.href, Status.toString(status));
    return [status];
  }

  let feed;
  if(response) {
    [status, feed] = await createFeedFromResponse(context, feed, url);
    if(status !== Status.OK) {
      console.error('Error creating feed from response:', url.href, Status.toString(status));
      return [status];
    }
  } else {
    // Offline subscription
    feed = Feed.create();
    Feed.appendURL(feed, url);
  }

  // Set the feed's favicon
  const faviconService = new FaviconService();
  faviconService.cache = context.iconCache;
  faviconService.skipURLFetch = true;
  status = await setFeedFavicon(faviconService, feed);
  if(status !== Status.OK) {
    console.error('Set feed favicon error:', url.href, Status.toString(status));
    return [status];
  }

  // Store the feed
  let storableFeed;
  [status, storableFeed] = await saveFeed(context.feedStore, feed);
  if(status !== Status.OK) {
    console.error('Database error:', url.href, Status.toString(status));
    return [status];
  }

  if(context.notify) {
    showNotification(storableFeed);
  }

  // If not concurrent with other subscribe calls, schedule a poll
  if(!context.concurrent) {
    // Call non-awaited to allow for subscribe to settle first
    deferredPollFeed(storableFeed).catch(console.warn);
  }

  return [Status.OK, storableFeed];
}

async function createFeedFromResponse(context, response, url) {
  let status;
  let containsFeed = false;

  const responseURL = new URL(response.url);
  if(FetchUtils.detectURLChanged(url, responseURL)) {
    url = responseURL;
    [status, containsFeed] = await context.feedStore.containsFeedWithURL(url);
    if(status !== Status.OK) {
      console.error('Database error:', url.href, Status.toString(status));
      return [status];
    }

    if(containsFeed) {
      console.debug('Already subscribed to redirect url', url.href);
      return [Status.EDBCONSTRAINT];
    }
  }

  let responseText;
  try {
    responseText = await response.text();
  } catch(error) {
    console.debug(error);
    return [Status.EFETCH];
  }

  const procEntries = false;
  let coerceResult;
  [status, coerceResult] = coerceFeed(responseText, url, responseURL,
    FetchUtils.getLastModified(response), procEntries);
  if(status !== Status.OK) {
    console.error('Parse feed error:', url.href, Status.toString(status));
    return [status];
  }

  return [Status.OK, coerceResult.feed];
}

async function setFeedFavicon(faviconService, feed) {
  if(!Feed.isFeed(feed)) {
    return Status.EINVAL;
  }

  const lookupURL = Feed.createIconLookupURL(feed);
  const [status, iconURLString] = await faviconService.lookup(lookupURL);
  if(status !== Status.OK) {
    console.error('Favicon lookup error:', Status.toString(status));
    return status;
  }

  if(iconURLString) {
    feed.faviconURLString = iconURLString;
  }

  return Status.OK;
}

async function saveFeed(feedStore, feed) {
  const storableFeed = feedStore.prepareFeed(feed);
  storableFeed.active = true;
  storableFeed.dateCreated = new Date();

  const [status, feedId] = await feedStore.putFeed(feed);
  if(status !== Status.OK) {
    console.error('Failed to put feed:', Status.toString(status));
    return status;
  }

  storableFeed.id = feedId;
  return [Status.OK, storableFeed];
}

function showNotification(feed) {
  const title = 'Subscribed!';
  const feedName = feed.title || Feed.peekURL(feed);
  const message = 'Subscribed to ' + feedName;
  showDesktopNotification(title, message, feed.faviconURLString);
}

async function deferredPollFeed(feed) {
  await sleep(50);

  const poll = new FeedPoll();
  poll.init();

  // We just fetched the feed. We definitely want to be able to process its entries, so disable
  // these checks because they most likely otherwise cancel the poll.
  poll.ignoreRecencyCheck = true;
  poll.ignoreModifiedCheck = true;

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

// Returns a promise that resolves after the given number of milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
