import coerceFeed from '/src/coerce-feed.js';
import {detectURLChanged, fetchFeed, fetchHTML, getLastModified, OfflineError, TimeoutError} from '/src/common/fetch-utils.js';
import {parseHTML} from '/src/common/html-utils.js';
import {lookup as lookupFavicon, open as openIconDb} from '/src/favicon-service.js';
import applyAllDocumentFilters from '/src/feed-poll/filters/apply-all.js';
import isBinaryURL from '/src/feed-poll/is-binary-url.js';
import rewriteURL from '/src/feed-poll/rewrite-url.js';
import showDesktopNotification from '/src/notifications.js';
import {addEntry, containsEntryWithURL, entryAppendURL, entryHasURL, entryPeekURL, feedHasURL, feedPeekURL, findActiveFeeds, isEntry, isFeed, mergeFeeds, open as openReaderDb, prepareFeed, putFeed} from '/src/rdb.js';

// TODO: this should not be dependent on something in the view, it should be
// the other way around
import updateBadgeText from '/src/views/update-badge-text.js';

// TODO: rename to poll-service
// TODO: to enforce that the feed parameter is a feed object loaded from the
// database, it is possible that pollFeed would be better implemented if it
// instead accepted a feedId as a parameter rather than an in-mem feed. That
// would guarantee the feed it works with is more trusted regarding the locally
// loaded issue.

const defaultPollFeedsContext = {
  feedConn: null,
  iconConn: null,
  channel: null,
  ignoreRecencyCheck: false,
  ignoreModifiedCheck: false,
  recencyPeriod: 5 * 60 * 1000,
  fetchFeedTimeout: 5000,
  fetchHTMLTimeout: 5000,
  fetchImageTimeout: 3000,
  deactivationThreshold: 10,
  // By default, direct all messages to void
  console: {log: noop, warn: noop, debug: noop}
};

function noop() {}

// Create a new context object that is the typical context used by pollFeeds
export async function createPollFeedsContext() {
  const context = {};
  const promises = [openReaderDb(), openIconDb()];
  [context.feedConn, context.iconConn] = await Promise.all(promises);

  // TODO: consider moving all lifetime management to caller
  // NOTE: this is the source of an object leak in slideshow context, where
  // this channel is created then replaced and left open. It has no listener,
  // but it is still heavyweight and and well, just incorrect.
  context.channel = new BroadcastChannel('reader');

  return context;
}

// Releases resources held in the context
// TODO: always closing channel is impedance mismatch with persistent channels
// used by calling contexts, rendering callers unable to easily call this
// function. Consider removing the close call here, or moving all channel
// lifetime management concerns to caller. This was the source of a bug in
// polling from slideshow, where polling closed the slideshow's persistent
// channel when it should not have
export function closePollFeedsContext(context) {
  if (context.channel) context.channel.close();
  if (context.feedConn) context.feedConn.close();
  if (context.iconConn) context.iconConn.close();
}

export async function pollFeeds(inputPollFeedsContext) {
  const pollFeedsContext =
      Object.assign({}, defaultPollFeedsContext, inputPollFeedsContext);

  pollFeedsContext.console.log('Polling feeds...');

  // Sanity check some of the context state
  assert(pollFeedsContext.feedConn instanceof IDBDatabase);
  assert(pollFeedsContext.iconConn instanceof IDBDatabase);
  assert(pollFeedsContext.channel instanceof BroadcastChannel);

  // Setup a pollFeedContext to be shared among upcoming pollFeed calls
  const pollFeedContext = Object.assign({}, pollFeedsContext);
  // Append some flags specific to pollFeed and not pollFeeds
  pollFeedContext.updateBadgeText = false;
  pollFeedContext.notify = false;

  // Concurrently poll all the feeds
  const feeds = await findActiveFeeds(pollFeedsContext.feedConn);
  const pollFeedPromises = [];
  for (const feed of feeds) {
    const promise = pollFeed(pollFeedContext, feed);
    pollFeedPromises.push(promise);
  }

  // Wait for all outstanding promises to settle, then count up the total.
  // pollFeed promises only throw in the case of programming/logic errors
  const pollFeedResolutions = await Promise.all(pollFeedPromises);
  let totalNumEntriesAdded = 0;
  for (const numEntriesAdded of pollFeedResolutions) {
    if (!isNaN(numEntriesAdded)) {
      totalNumEntriesAdded += numEntriesAdded;
    }
  }

  if (totalNumEntriesAdded) {
    // TODO: it would be better to pass along feedConn here while still not
    // awaiting. So long as the call starts, it should be fine
    updateBadgeText(pollFeedsContext.feedConn);
  }

  if (totalNumEntriesAdded) {
    const title = 'Added articles';
    const message = 'Added articles';
    showDesktopNotification(title, message);
  }

  pollFeedsContext.console.log('Added %d new entries', totalNumEntriesAdded);
}

export async function pollFeed(inputPollFeedContext, feed) {
  const pollFeedContext =
      Object.assign({}, defaultPollFeedsContext, inputPollFeedContext);

  // Recheck sanity given this may not be called by pollFeeds
  assert(pollFeedContext.feedConn instanceof IDBDatabase);
  assert(pollFeedContext.iconConn instanceof IDBDatabase);
  assert(pollFeedContext.channel instanceof BroadcastChannel);
  assert(isFeed(feed));
  assert(feedHasURL(feed));

  const console = pollFeedContext.console;
  const feedTailURL = new URL(feedPeekURL(feed));
  console.log('Polling feed', feedTailURL.href);

  // Avoid polling inactive feeds
  if (!feed.active) {
    console.debug('Canceling poll feed as feed inactive', feedTailURL.href);
    return 0;
  }

  // Avoid polling recently polled feeds
  if (polledFeedRecently(pollFeedContext, feed)) {
    console.debug(
        'Canceling poll feed as feed polled recently', feedTailURL.href);
    return 0;
  }

  // Fetch the feed. Trap the error to allow for Promise.all(pollFeed) to not
  // short-circuit.
  let response;
  try {
    response = await fetchFeed(feedTailURL, pollFeedContext.fetchFeedTimeout);
  } catch (error) {
    console.debug(error);

    handlePollFeedError({
      context: pollFeedContext,
      error: error,
      feed: feed,
      category: 'fetch-feed'
    });

    return 0;
  }

  // Cancel polling if no change in date modified
  if (!detectedModification(
          pollFeedContext.ignoreModifiedCheck, feed, response)) {
    const stateChanged = handleFetchFeedSuccess(feed);
    if (stateChanged) {
      feed.dateUpdated = new Date();
      await putFeed(pollFeedContext.feedConn, pollFeedContext.channel, feed);
    }
    return 0;
  }

  // Get the body of the response
  let responseText;
  try {
    responseText = await response.text();
  } catch (error) {
    console.debug(error);
    handlePollFeedError({
      context: pollFeedContext,
      error: error,
      feed: feed,
      category: 'read-response-body'
    });
    return 0;
  }

  // Parse and coerce the response
  let parseResult;
  const processEntries = true;
  const responseURL = new URL(response.url);
  const responseLastModifiedDate = getLastModified(response);
  try {
    parseResult = coerceFeed(
        responseText, feedTailURL, responseURL, responseLastModifiedDate,
        processEntries);
  } catch (error) {
    console.debug(error);
    handlePollFeedError({
      context: pollFeedContext,
      error: error,
      feed: feed,
      category: 'coerce-feed'
    });
    return 0;
  }

  // Integrate the loaded feed with the fetched feed and store the
  // result in the database
  const mergedFeed = mergeFeeds(feed, parseResult.feed);

  // If we did not exit earlier as a result of some kind of error, then we want
  // to possibly decrement the error count and save the updated error count, so
  // that errors do not persist indefinitely.
  handleFetchFeedSuccess(mergedFeed);

  const storableFeed = prepareFeed(mergedFeed);
  storableFeed.dateUpdated = new Date();
  await putFeed(
      pollFeedContext.feedConn, pollFeedContext.channel, storableFeed);

  // Process the feed's entries

  const pollEntryContext = Object.assign({}, pollFeedContext);

  const entries = parseResult.entries;
  cascadeFeedPropertiesToEntries(storableFeed, entries);
  const pollEntryPromises = [];
  for (const entry of entries) {
    const promise = pollEntry(pollEntryContext, entry);
    pollEntryPromises.push(promise);
  }

  const entryIds = await Promise.all(pollEntryPromises);
  let numEntriesAdded = 0;
  for (const entryId of entryIds) {
    if (entryId) {
      numEntriesAdded++;
    }
  }

  if (pollEntryContext.updateBadgeText && numEntriesAdded) {
    updateBadgeText(pollEntryContext.feedConn);
  }

  if (pollEntryContext.notify && numEntriesAdded) {
    const title = 'Added articles';
    const message =
        'Added ' + numEntriesAdded + ' articles for feed ' + storableFeed.title;
    showDesktopNotification(title, message);
  }

  return numEntriesAdded;
}

function polledFeedRecently(pollFeedContext, feed) {
  if (pollFeedContext.ignoreRecencyCheck) {
    return false;
  }

  if (!feed.dateFetched) {
    return false;
  }

  const currentDate = new Date();
  const millisElapsed = currentDate - feed.dateFetched;
  assert(millisElapsed >= 0, 'Polled feed in future??');

  return millisElapsed < pollFeedContext.recencyPeriod;
}

// Decrement error count if set and not 0. Return true if object state changed.
function handleFetchFeedSuccess(feed) {
  if ('errorCount' in feed) {
    if (typeof feed.errorCount === 'number') {
      if (feed.errorCount > 0) {
        feed.errorCount--;
        return true;
      } else {
        console.assert(feed.errorCount === 0);
      }
    } else {
      delete feed.errorCount;
      return true;
    }
  }
  return false;
}

// TODO: new kind of problem, in hindsight, is merging of count of errors for
// parsing and fetching. suppose a feed file which is periodically updated
// becomes not-well-formed, causing parsing error. This is going to on the poll
// period update the error count. This means that after a couple polls, the
// feed quickly becomes inactive. That would be desired for the fetch error
// count, maybe, but not for the parse error count. Because eventually the feed
// file will get updated again and probably become well formed again. I've
// actually witnessed this. So the issue is this prematurely deactivates feeds
// that happen to have a parsing error that is actually ephemeral (temporary)
// and not permanent.

// TODO: rather than try and update the database, perhaps it would be better to
// simply generate an event with feed id and some basic error information, and
// let some error handler handle the event at a later time. This removes all
// concern over encountering a closed database or closed channel at the time of
// the call to putFeed, and maintains the non-blocking characteristic.
function handlePollFeedError(errorInfo) {
  if (errorInfo.error instanceof OfflineError ||
      errorInfo.error instanceof TimeoutError) {
    console.debug('Ignoring ephemeral poll feed error', errorInfo.error);
    return;
  }

  feed.errorCount = Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;
  if (feed.errorCount > errorInfo.context.deactivationThreshold) {
    feed.active = false;
    feed.deactivationReasonText = errorInfo.category;
    feed.deactivationDate = new Date();
  }

  feed.dateUpdated = new Date();
  // Call unawaited (non-blocking)
  putFeed(errorInfo.context.feedConn, errorInfo.context.channel, feed)
      .catch(console.error);
}

function detectedModification(ignoreModifiedCheck, feed, response) {
  // If this flag is true, then pretend the feed is always modified
  // I am leaving this comment here as a reminder, previously this was a bug
  // where I returned false. Now I return true to indicate the feed SHOULD be
  // polled. Minor ambiguity, this function is a combination of 'shouldPoll'
  // and 'didChange', hence the confusion.
  if (ignoreModifiedCheck) {
    return true;
  }

  // TODO: rename dateLastModified to lastModifiedDate to be more consistent
  // in field names. I just got bit by this inconsistency.

  // Pretend feed modified if no known modified date
  // NOTE: this returns true to indicate the feed SHOULD be considered modified,
  // because without the last modified date, we can't use the dates to
  // determine, so we presume modified. We can only more confidently assert not
  // modified, but not unmodified.
  if (!feed.dateLastModified) {
    console.debug('Unknown last modified date for feed', feedPeekURL(feed));
    return true;
  }

  const rDate = getLastModified(response);

  // If response is undated, then return true to indicate maybe modified
  if (!rDate) {
    // TODO: if it is the normal case this shouldn't log. I am tentative for
    // now, so logging
    console.debug('Response missing last modified date?', response);
    return true;
  }

  // TEMP: researching always unmodified issue
  console.debug(
      'local %d remote %d', feed.dateLastModified.getTime(), rDate.getTime());

  // Return true if the dates are different
  // Return false if the dates are the same
  return feed.dateLastModified.getTime() !== rDate.getTime();
}

function cascadeFeedPropertiesToEntries(feed, entries) {
  for (const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;

    if (feed.datePublished && !entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }
}

// Returns the entry id if added.
async function pollEntry(ctx, entry) {
  assert(typeof ctx === 'object');
  // The sanity check for the entry argument is implicit in the call to
  // entryHasURL

  // This function cannot assume the input entry has a url, but a url is
  // required to continue polling the entry
  if (!entryHasURL(entry)) {
    return;
  }

  rewriteEntryURL(entry);

  if (await entryExistsInDb(ctx.feedConn, entry)) {
    return;
  }

  const response = await fetchEntryResponse(entry, ctx.fetchHTMLTimeout);
  const redirectedEntryExistsInDb =
      await handleEntryRedirect(ctx.feedConn, response, entry);
  if (redirectedEntryExistsInDb) {
    return;
  }

  const document = await parseEntryResponseBody(response);
  updateEntryTitle(entry, document);
  await updateEntryFavicon(ctx, entry, document);
  await updateEntryContent(ctx, entry, document);

  // Despite checks for whether the url exists, we can still get uniqueness
  // constraint errors when putting an entry in the store (from url index of
  // entry store). This should not be fatal to polling, so trap and log the
  // error and return.

  // TODO: I think I need to look into this more. This may be a consequence of
  // not using a single shared transaction. Because I am pretty sure that if I
  // am doing containsEntryWithURL lookups, that I shouldn't run into this
  // error here? It could also be a dedup issue. Which I now realize should not
  // be a concern of coerceFeed, it should only be a concern here.
  // It could be the new way I am doing url rewriting. Perhaps I need to do
  // contains checks on the intermediate urls of an entry's url list as well.
  // Which would lead to more contains lookups, so maybe also look into
  // batching those somehow.

  let storedEntry;
  try {
    storedEntry = await addEntry(ctx.feedConn, ctx.channel, entry);
  } catch (error) {
    console.error(entry.urls, error);
    return;
  }

  return storedEntry.id;
}

// Examines the current tail url of the entry. Attempts to rewrite it and
// append a new tail url if the url was rewritten and was distinct from other
// urls. Returns true if a new url was appended.
function rewriteEntryURL(entry) {
  // sanity assertions about the entry argument are implicit within
  // entryPeekURL
  const turl = new URL(entryPeekURL(entry));
  const rurl = rewriteURL(turl);
  // rewriteURL returns undefined in case of error, or when no rewriting
  // occurred.
  // TODO: consider changing rewriteURL so that it always returns a url, which
  // is simply the same url as the input url if no rewriting occurred.

  if (!rurl) {
    return false;
  }

  // entryAppendURL only appends the url if the url does not already exist in
  // the entry's url list. entryAppendURL returns true if an append took place.
  return entryAppendURL(rurl);
}

function entryExistsInDb(conn, entry) {
  // NOTE: this only inspects the tail, not all urls. It is possible due to
  // some poorly implemented logic that one of the other urls in the entry's
  // url list exists in the db At the moment I am more included to allow the
  // indexedDB put request that happens later to fail due to a constraint
  // error. This function is more of an attempt at reducing processing than
  // maintaining data integrity.

  const tailURL = new URL(entryPeekURL(entry));
  return containsEntryWithURL(conn, tailURL);
}

// Tries to fetch the response for the entry. Returns undefined if the url is
// not fetchable by polling policy, or if the fetch fails.
async function fetchEntryResponse(entry, timeout) {
  const url = new URL(entryPeekURL(entry));
  if (!isAugmentableURL(url)) {
    return;
  }

  try {
    return await fetchHTML(url, timeout);
  } catch (error) {
    console.debug(error);
  }
}

// Checks if the entry redirected, and if so, possibly updates the entry and
// returns whether the redirect url already exists in the database
async function handleEntryRedirect(conn, response, entry) {
  // response may be undefined due to fetch error, this is not an error or
  // unexpected
  if (!response) {
    return false;
  }

  const turl = new URL(entryPeekURL(entry));
  const rurl = new URL(response.url);
  if (!detectURLChanged(turl, rurl)) {
    return false;
  }

  entryAppendURL(entry, rurl);

  // It is important to rewrite before exists check to be consistent with the
  // pattern used before fetching for the original url. This way we don't need
  // to lookup the unwritten url, because all urls are always rewritten before
  // storage

  rewriteEntryURL(entry);
  return await entryExistsInDb(conn, entry);
}

async function parseEntryResponseBody(response) {
  // There is no guarantee response is defined, this is not unexpected and not
  // an error
  if (!response) {
    return;
  }

  try {
    const responseText = await response.text();
    return parseHTML(responseText);
  } catch (error) {
    console.debug(error);
  }
}

// If an entry is untitled in the feed, and we were able to fetch the full
// text of the entry, try and set the entry's title using data from the full
// text.
function updateEntryTitle(entry, document) {
  assert(isEntry(entry));
  // This does not expect document to always be defined. The caller may have
  // failed to get the document. Rather than require the caller to check, do
  // the check here.
  if (!document) {
    return;
  }

  // This only applies to an untitled entry.
  if (entry.title) {
    return;
  }

  const titleElement = document.querySelector('html > head > title');
  if (titleElement) {
    entry.title = titleElement.textContent;
  }
}

// Attempts to set the favicon url property of the entry
// @param ctx {Object} misc props, should contain iconConn, an active
// connection to the favicon store. Technically the lookup can operate without
// an active connection so it is ok if it is undefined
// @param entry {Object} an object representing a entry in the app's storage
// format
// @param document {Document} optional, the pre-fetched document for the entry.
// If specified, the favicon lookup will reuse it instead of attempting to
// fetch the document again.
async function updateEntryFavicon(ctx, entry, document) {
  assert(typeof ctx === 'object');
  assert(isEntry(entry));

  // Something is really wrong if this fails
  assert(entryHasURL(entry));

  const tailURL = new URL(entryPeekURL(entry));

  // Create the lookup context. Signal to the lookup it should not try and
  // fetch the document for the url, because we know we've already tried that.
  // Lookup cannot otherwise tell because document may be undefined here.

  const lookupContext = {
    conn: ctx.iconConn,
    skipURLFetch: true,
    url: tailURL,
    document: document
  };

  // Favicon lookup failure is not fatal to polling an entry. Rather than
  // require the caller to handle the error, handle the error locally.

  // TODO: if favicon only fails in event of a critical error, such as a
  // programming error or database error, then it actually should be fatal, and
  // this shouldn't use try/catch. However, I've forgotten all the specific
  // cases of when the lookup throws. If it throws in case of failed fetch for
  // example that is not a critical error. For now I am leaving in the
  // try/catch.

  try {
    const iconURLString = await lookupFavicon(lookupContext);

    // Only set favicon if found. This way the previous value is retained.
    // Earlier code may set it, for example, to default to the feed's own
    // favicon.
    if (iconURLString) {
      entry.faviconURLString = iconURLString;
    }
  } catch (error) {
    console.debug(error);
  }
}

async function updateEntryContent(ctx, entry, fetchedDocument) {
  // There is no expectation that document is defined. When undefined, we want
  // to use the entry original summary content from the feed. In both cases the
  // content must be filtered

  let document = fetchedDocument;
  if (!document) {
    try {
      document = parseHTML(entry.content);
    } catch (error) {
      console.debug(error);
      // We do not have a fetched doc, and we also failed to parse the entry's
      // content from the feed. Redact the content for safety.
      entry.content =
          'There was a problem with this article\'s content (unsafe HTML).';
      return;
    }
  }

  const documentURL = new URL(entryPeekURL(entry));
  await applyAllDocumentFilters(document, documentURL, ctx.fetchImageTimeout);
  entry.content = document.documentElement.outerHTML;
}

function isAugmentableURL(url) {
  return isHTTPURL(url) && !isBinaryURL(url) && !isInaccessibleContentURL(url);
}

// An array of descriptors. Each descriptor represents a test against a url
// hostname, that if matched, indicates the content is not accessible.
const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'}
];

function isInaccessibleContentURL(url) {
  for (const desc of INACCESSIBLE_CONTENT_DESCRIPTORS) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function isHTTPURL(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
