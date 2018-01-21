import showDesktopNotification from "/src/notifications.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import * as Status from "/src/common/status.js";
import {lookup} from "/src/favicon-service.js";
import FeedPoll from "/src/feed-poll/poll-feeds.js";
import * as Feed from "/src/feed-store/feed.js";
import {containsFeedWithURL, prepareFeed, putFeed} from "/src/feed-store/feed-store.js";
import coerceFeed from "/src/coerce-feed.js";

// TODO: reconsider the transaction lifetime. Right now it is protected by the error that
// occurs due to violation of uniqueness constraint. But it would be better if both reads and
// writes occurred on same transaction. Also because I have mixed feelings about treating
// already-subscribed as an error. It isn't a programming error.

// TODO: currently the redirect url is not validated as to whether it is a fetchable
// url according to the app's fetch policy. It is just assumed. I am not quite sure what to
// do about it at the moment. Maybe I could create a second policy that controls what urls
// are allowed by the app to be stored in the database? Or maybe I should just call
// isAllowedURL here explicitly? This is partly a caveat of attempting to abstract it away behind
// the call to the fetch helper, which checks the policy internally. The issue is that it cannot
// be abstracted away if I need to use it again for non-fetch purposes. So really it is just the
// wrong abstraction.
// TODO: reconsider how notify overlaps with concurrent. For that matter, the term concurrent is
// overly abstract and instead should be named more specifically to what it does, such as
// enqueuePoll
// TODO: notify a channel of feed created. Perhaps provide an optional channel argument so that
// the caller is responsible for channel maintenance and reference.
// TODO: the polling of entries after subscribing is still kind of wonky and should eventually
// be more well thought out.

// TODO: revert to using exceptions and assert
// TODO: connect on demand
// TODO: channel should be parameter configured externally
// TODO: treat context as immutable

// Properties for the context argument:
// feedConn, database conn to feed store
// iconConn, database conn to icon store, optional
// fetchFeedTimeoutMs, integer, optional
// concurrent, boolean, optional, whether called concurrently
// notify, boolean, optional, whether to notify
// NOTE: the caller should not expect context is immutable

export default async function subscribe(context, url) {
  if(typeof context !== 'object') {
    return [Status.EINVAL];
  }

  if(!(context.iconConn instanceof IDBDatabase)) {
    return [Status.EINVAL];
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

  let status;

  let containsFeed;
  try {
    containsFeed = await containsFeedWithURL(context.feedConn, url);
  } catch(error) {
    console.error(error);
    return [Status.EDB];
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
  const query = {};
  query.conn = context.iconConn;
  query.skipURLFetch = true;

  status = await setFeedFavicon(query, feed);
  if(status !== Status.OK) {
    console.error('Set feed favicon error:', url.href, Status.toString(status));
    return [status];
  }

  // Store the feed
  let storableFeed;
  [status, storableFeed] = await saveFeed(context.feedConn, feed);
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

    try {
      containsFeed = await containsFeedWithURL(context.conn, url);
    } catch(error) {
      console.error(error);
      return [Status.EDB];
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

  // TODO: not sure if this should be try/catch. This should probably just rethrow?
  // Revisit after decoupling status.js
  try {
    coerceResult = coerceFeed(responseText, url, responseURL,
      FetchUtils.getLastModified(response), procEntries);
  } catch(error) {
    return [Status.EFETCH];
  }


  [status, coerceResult] =
  if(status !== Status.OK) {
    console.error('Parse feed error:', url.href, Status.toString(status));
    return [status];
  }

  return [Status.OK, coerceResult.feed];
}

async function setFeedFavicon(query, feed) {
  if(!Feed.isFeed(feed)) {
    return Status.EINVAL;
  }

  const lookupURL = Feed.createIconLookupURL(feed);

  let iconURLString;
  try {
    iconURLString = await lookup(query);
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  if(iconURLString) {
    feed.faviconURLString = iconURLString;
  }

  return Status.OK;
}

async function saveFeed(conn, feed) {

  // TODO: this should delegate to an 'addFeed' function in feed-store.js that
  // does the sanitization work implicitly and forwards to putFeed, and also sets
  // the id of the input feed object

  const storableFeed = prepareFeed(feed);
  storableFeed.active = true;
  storableFeed.dateCreated = new Date();

  // TODO: use a channel
  let nullChannel = null;
  try {
    await putFeed(conn, nullChannel, feed);
  } catch(error) {
    console.error(error);
    return Status.EDB;
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

// TODO: perhaps instead of calling this, there should be an observer somewhere listening
// for 'feed-added' events that automatically triggers the poll. addFeed in feed-store would
// post a message to a channel, and that observer would automatically pick it up. Then there is
// need to call this explicitly, at all.

async function deferredPollFeed(feed) {

  // TODO: why sleep at all? If caller forked us, why artificially delay?
  await sleep(50);

  const poll = new FeedPoll();
  poll.init();

  // We just fetched and added the feed. We definitely want to be able to process its entries,
  // so disable these checks because they most likely otherwise cancel the operation
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
