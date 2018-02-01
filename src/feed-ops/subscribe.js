import coerceFeed from '/src/coerce-feed.js';
import {detectURLChanged, fetchFeed, getLastModified, OfflineError} from '/src/common/fetch-utils.js';
import {lookup} from '/src/favicon-service.js';
import {closePollFeedsContext, createPollFeedsContext, pollFeed} from '/src/feed-poll/poll-feeds.js';
import showDesktopNotification from '/src/notifications.js';
import {addFeed, containsFeedWithURL, createFeed, createIconLookupURLForFeed, feedAppendURL, feedPeekURL, isFeed} from '/src/rdb.js';

// TODO: reconsider the transaction lifetime. Right now it is protected by the
// error that occurs due to violation of uniqueness constraint. But it would be
// better if both reads and writes occurred on same transaction. Also because I
// have mixed feelings about treating already-subscribed as an error. It isn't a
// programming error. But the subscribe in some sense failed.

// TODO: currently the redirect url is not validated as to whether it is a
// fetchable url according to the app's fetch policy. It is just assumed. I am
// not quite sure what to do about it at the moment. Maybe I could create a
// second policy that controls what urls are allowed by the app to be stored in
// the database? Or maybe I should just call isAllowedURL here explicitly? This
// is partly a caveat of attempting to abstract it away behind the call to the
// fetch helper, which checks the policy internally. The issue is that it cannot
// be abstracted away if I need to use it again for non-fetch purposes. So
// really it is just the wrong abstraction. Move this comment to github

// Properties for the context argument:
// feedConn {IDBDatabase} an open conn to feed store
// iconConn {IDBDatabase} an open conn to icon store
// channel {BroadcastChannel} optional, an open channel to which to send feed
// added message
// fetchFeedTimeout {Number} optional, positive integer, how long to wait in ms
// before considering fetch a failure
// notify {Boolean} optional, whether to show a desktop notification
// console {console object} optional, console-like logging destination
export default async function subscribe(context, url) {
  assert(typeof context === 'object');
  assert(context.feedConn instanceof IDBDatabase);
  assert(context.iconConn instanceof IDBDatabase);
  assert(url instanceof URL);
  const console = context.console || NULL_CONSOLE;
  console.log('Subscribing to', url.href);

  // If this fails, throw an error
  let containsFeed = await containsFeedWithURL(context.feedConn, url);

  // If already subscribed, throw an error
  // TODO: is this really an error? This isn't an error. This just means cannot
  // subscribe, but it isn't exception worthy. Should I return undefined
  // instead? But then how do I know about failure? This is not a programmer
  // error. This is just rejected user input, and users can input whatever they
  // want. Even then, should I use an exception anyway? Ugh.
  if (containsFeed) {
    throw new Error('Already subscribed to ' + url.href);
  }

  let response;
  try {
    response = await fetchFeed(url, context.fetchFeedTimeout || 2000);
  } catch (error) {
    if (error instanceof OfflineError) {
      // continue with subscription
      console.debug('Subscribing while offline to', url.href);
    } else {
      throw error;
    }
  }

  let feed;
  if (response instanceof Response) {
    // Allow errors to bubble
    feed = await createFeedFromResponse(context, response, url);
  } else {
    // Offline subscription
    feed = createFeed();
    feedAppendURL(feed, url);
  }

  // Set the feed's favicon
  const query = {};
  query.conn = context.iconConn;
  query.skipURLFetch = true;

  await setFeedFavicon(query, feed, console);

  const storedFeed = await addFeed(context.feedConn, context.channel, feed);

  if (context.notify || !('notify' in context)) {
    showNotification(storedFeed);
  }

  // Call non-awaited (in a non-blocking manner) to allow for subscribe to
  // settle before this completes.
  deferredPollFeed(storedFeed).catch(console.warn);

  return storedFeed;
}

async function createFeedFromResponse(context, response, url) {
  const responseURL = new URL(response.url);

  // If there was a redirect, then check if subscribed to the redirect
  if (detectURLChanged(url, responseURL)) {
    // Allow database error to bubble uncaught
    const containsFeed = await containsFeedWithURL(context.conn, responseURL);
    if (containsFeed) {
      throw new Error('Already susbcribed to redirect url ' + responseURL.href);
    }
  }

  // Treat any fetch error here as fatal. We are past the point of trying to
  // subscribe while offline. This basically should never throw
  const responseText = await response.text();

  // Take the fetched feed xml and turn it into a storable feed object
  // Treat any coercion error as fatal and allow the error to bubble
  const procEntries = false;
  const result = coerceFeed(
      responseText, url, responseURL, getLastModified(response), procEntries);

  return result.feed;
}

async function setFeedFavicon(query, feed, console) {
  assert(isFeed(feed));

  const lookupURL = createIconLookupURLForFeed(feed);

  // Lookup errors are not fatal. Simply do nothing on error.
  let iconURLString;
  try {
    iconURLString = await lookup(query);
  } catch (error) {
    console.debug(error);
    return;
  }

  if (iconURLString) {
    feed.faviconURLString = iconURLString;
  }
}

function showNotification(feed) {
  const title = 'Subscribed!';
  const feedName = feed.title || feedPeekURL(feed);
  const message = 'Subscribed to ' + feedName;
  showDesktopNotification(title, message, feed.faviconURLString);
}

async function deferredPollFeed(feed) {
  const ctx = await createPollFeedsContext();
  ctx.ignoreRecencyCheck = true;
  ctx.ignoreModifiedCheck = true;
  ctx.notify = false;
  await pollFeed(ctx, feed);
  closePollFeedsContext(ctx);
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

function noop() {}

const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};
