import assert from "/src/assert/assert.js";
import {showNotification} from "/src/platform/platform.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import isAllowedURL from "/src/fetch/fetch-policy.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import pollFeed from "/src/jobs/poll/poll-feed.js";
import {PermissionsError} from "/src/operations/restricted-operation.js";
import parseFeed from "/src/reader/parse-feed.js";
import * as Feed from "/src/reader-db/feed.js";
import {ConstraintError} from "/src/reader-db/errors.js";
import putFeed from "/src/reader-db/put-feed.js";
import findFeedIdByURLInDb from "/src/reader-db/find-feed-id-by-url.js";
import openReaderDb from "/src/reader-db/open.js";
import {setURLHrefProperty} from "/src/url/url.js";
import check from "/src/utils/check.js";
import * as idb from "/src/utils/indexeddb-utils.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import setTimeoutPromise from "/src/utils/set-timeout-promise.js";

// Module for subscribing to a new feed

export function Context() {
  this.iconCache = undefined;
  this.readerConn = undefined;
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
  this.iconCache = new FaviconCache();
  const promises = [openReaderDb(), this.iconCache.open()];
  [this.readerConn] = await Promise.all(promises);
};

// Closes database connections
Context.prototype.close = function() {
  if(this.iconCache) {
    this.iconCache.close();
  }

  idb.close(this.readerConn);
};

// @param this {Context}
// @param feed {Object} the feed to subscribe to
// @returns {Object} the subscribed feed
export async function subscribe(feed) {
  assert(this instanceof Context);
  assert(idb.isOpen(this.readerConn));
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const url = Feed.peekURL(feed);

  console.debug('Subscribing to feed with url', url);

  // Convert the url string into a URL object. This implicitly validates that the url is valid,
  // and canonical, and normalizes the url as a string if and whenever the url is later serialized
  // back into a string. The url object is also used to track changes to the url during the course
  // of this subscribe function, and to fetch the feed.
  const urlObject = new URL(url);


  // Check whether policy permits subscribing to the url
  // Issue #418
  // TODO: I've moved the policy check concern from here to fetchFeed given that it is shared by
  // several other components that depend on fetching. However, while it works in the destination
  // of the move, I have not fully removed all logic from here yet. See the following todos.
  // TODO: now that isAllowedURL is no longer called, I think PermissionsError no longer is
  // needed as an explicit import? And also isAllowedURL is no longer needed?
  // TODO: now that isAllowedURL is no longer called, consider that I still want to pre-emptively
  // check it instead of delegating the functionality to fetchFeed later. Checking it earlier
  // would improve the performance, because it is a simple function, and would avoid the database
  // request.
  //check(isAllowedURL(urlObject), PermissionsError, urlObject, 'not permitted');

  // Check that user is not already subscribed
  let priorFeedId = await findFeedIdByURLInDb(this.readerConn, url);
  check(!priorFeedId, ConstraintError, 'already subscribed to feed with url', url);

  // TODO: fetchFeed (internally) is responsible for handling online/offline detection. Also,
  // there is now an isOnline function in platform.js. Instead of checking if online, this should
  // immediately try and fetch the feed, and then check if the fetch error is instanceof
  // OfflineError

  if(navigator.onLine || !('onLine' in navigator)) {
    // If online, then fetch the feed at the given url. Do not catch any fetch errors, because
    // a fetch failure when online indicates the feed is 'invalid', which is fatal because I want
    // to prevent the ability to subscribe to an invalid feed. Subscribe isn't just a simple
    // database operation it is also a verification check.

    // If online then fetch failure is fatal to subscribing
    // TODO: unless the error is OfflineError, which fetchFeed may now throw because I recently
    // added connectivity check to fetch. I think in this case, when fetch fails with offline
    // error and not some other error, we want it to not be fatal. In fact, probably should not
    // even check offline case at start of this block, instead proceed with try/catch and check
    // if error is offlineerror within catch block.

    const res = await fetchFeed(urlObject, this.fetchFeedTimeoutMs, this.extendedFeedTypes);

    // If redirected, then the url changed. Perform checks on the post-redirect url
    if(res.redirected) {

      // TODO: this change may no longer be needed due to 418, I think the variable is no longer
      // in use?
      setURLHrefProperty(urlObject, res.responseURL);

      // Check whether policy permits subscribing to the redirected url
      // NOTE: as a result of 418 change, redirect is not checked by isAllowedURL. This is a change
      // in behavior as a result.
      // TODO: in the event of a redirect, do I not also need to verify the redirected url is
      // a permitted url? Or should this also be a concern of fetchFeed? Or is the policy of
      // fetching distinct, partially or completely, from the policy of storing? Or basically am
      // I delegating cache-entry policy to fetch-policy implicitly, and I shouldn't be doing that,
      // so I actually need to go and create a cache-entry policy that allows or disallows entry
      // into the database of feeds with certain urls?

      //check(isAllowedURL(urlObject), PermissionsError, urlObject, 'not permitted');

      // Check that user is not already subscribed now that we know redirect
      priorFeedId = await findFeedIdByURLInDb(this.readerConn, res.responseURL);

      // TODO: this is a pretty weak check, maybe use Feed.isValidFeedId?
      check(!priorFeedId, ConstraintError, 'already subscribed');
    }

    // Get the full response body in preparation for parsing now that we know we are going to
    // continue.
    const xml = await res.text();

    // TODO: I just realized, that this isn't catching redirect? Shouldn't url here be
    // responseURL? The response url should be the base url. Now it is confusing because I've
    // wrapped up so much functionality in the parseFeed function, see all the comments there.

    // Do not process or store entries when subscribing
    const kProcEntries = false;
    const parseResult = parseFeed(xml, url, res.responseURL, res.lastModifiedDate, kProcEntries);
    feed = Feed.merge(feed, parseResult.feed);
  }

  // Set the feed's favicon
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

  // Store the feed in the database
  const kSkipPrep = false;
  const storedFeed = await putFeed(feed, this.readerConn, kSkipPrep);

  // Send a notification of the successful subscription
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
    deferredPollFeed(storedFeed).catch(console.warn);
  }

  return storedFeed;
}

// Returns a promise that resolves after the given number of milliseconds
function sleep(ms) {
  const [timer, timeoutPromise] = setTimeoutPromise(ms);
  return timeoutPromise;
}

// This is the initial implementation of Github issue #462
async function deferredPollFeed(feed) {
  await sleep(1000);

  const pc = new PollContext();
  pc.iconCache = new FaviconCache();

  // We just fetched the feed. We definitely want to be able to process its entries.
  pc.ignoreRecencyCheck = true;
  pc.ignoreModifiedCheck = true;

  // NOTE: this relies on the default extended accepted feed mime types rather than explicitly
  // configuring them here. Keep in mind this may be different than the explicitly specified types
  // in the main function. Generally the two should be the same but this isn't guaranteed.

  try {
    await pc.open();
    await pollFeed.call(pc, feed);
  } catch(error) {
    console.warn(error);
  } finally {
    pc.close();
  }
}
