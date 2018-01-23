import showDesktopNotification from "/src/notifications.js";
import {
  detectURLChanged,
  fetchFeed,
  fetchHTML,
  getLastModified,
  TimeoutError,
  OfflineError
} from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";
import {lookup as lookupFavicon, open as openIconDb} from "/src/favicon-service.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import applyAllDocumentFilters from "/src/feed-poll/filters/apply-all.js";
import rewriteURL from "/src/feed-poll/rewrite-url.js";
import isBinaryURL from "/src/feed-poll/is-binary-url.js";
import {
  addEntry,
  containsEntryWithURL,
  entryAppendURL,
  entryHasURL,
  entryPeekURL,
  feedHasURL,
  feedPeekURL,
  findActiveFeeds,
  isEntry,
  isFeed,
  mergeFeeds,
  open as openReaderDb,
  prepareFeed,
  putFeed
} from "/src/rdb.js";
import coerceFeed from "/src/coerce-feed.js";

// TODO: get rid of object pattern, revert to basic function

// An array of descriptors. Each descriptor represents a test against a url hostname, that if
// matched, indicates the content is not accessible.
const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'}
];

export default function FeedPoll() {
  this.feedConn = null;
  this.iconConn = null;
  this.channel = null;
  this.ignoreRecencyCheck = false;
  this.ignoreModifiedCheck = false;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;
  this.deactivationThreshold = 10;
}

FeedPoll.prototype.init = function() {
  assert(!this.feedConn);
  assert(!this.iconConn);
  assert(!this.channel);
  this.feedConn = null;
  this.iconConn = null;
  this.channel = null;
};

FeedPoll.prototype.open = async function() {
  assert(!this.iconConn);
  assert(!this.feedConn);
  assert(!this.channel);

  const promises = [openReaderDb(), openIconDb()];
  [this.feedConn, this.iconConn] = await Promise.all(promises);
  this.channel = new BroadcastChannel('reader');
};

FeedPoll.prototype.close = function() {
  if(this.channel) this.channel.close();
  if(this.feedConn) this.feedConn.close();
  if(this.iconConn) this.iconConn.close();
};

FeedPoll.prototype.pollFeeds = async function() {
  assert(this.feedConn instanceof IDBDatabase);
  assert(this.iconConn instanceof IDBDatabase);
  assert(this.channel instanceof BroadcastChannel);

  const feeds = await findActiveFeeds(this.feedConn);
  const batched = true;
  const promises = [];
  for(const feed of feeds) {
    promises.push(this.pollFeed(feed, batched));
  }
  const resolutions = await Promise.all(promises);
  const truthyResolutions = resolutions.filter(r => r);
  const totalNumEntriesAdded = truthyResolutions.length;

  if(totalNumEntriesAdded > 0) {
    updateBadgeText(); // non-blocking
  }

  if(totalNumEntriesAdded > 0) {
    const title = 'Added articles';
    const message = 'Added articles';
    showDesktopNotification(title, message);
  }

  console.log('Poll feeds completed normally, %d new entries', totalNumEntriesAdded);
};

// TODO: to enforce that the feed parameter is a feed object loaded from the database, it is
// possible that pollFeed would be better implemented if it instead accepted a feedId as a
// parameter, and loaded the feed here. That would guarantee the feed it works with is more trusted
// regarding the locally loaded issue.

// @param batched {Boolean} optional, if true then this does not send notifications or update
// the badge unread count
FeedPoll.prototype.pollFeed = async function(feed, batched) {
  assert(this.feedConn instanceof IDBDatabase);
  assert(this.iconConn instanceof IDBDatabase);
  assert(isFeed(feed));
  assert(feedHasURL(feed));

  const feedURLString = feedPeekURL(feed);
  console.log('Polling feed', feedURLString);

  if(!feed.active) {
    return 0;
  }

  if(this.didPollFeedRecently(feed)) {
    return 0;
  }

  const requestURL = new URL(feedURLString);

  let response;
  try {
    response = await fetchFeed(requestURL, this.fetchFeedTimeoutMs);
  } catch(error) {
    console.debug(error);

    handlePollFeedError({
      error: error,
      conn: this.feedConn,
      feed: feed,
      category: 'fetch-feed',
      threshold: this.deactivationThreshold,
      channel: this.channel
    });

    return 0;
  }

  const responseLastModifiedDate = getLastModified(response);

  if(this.isUnmodifiedFeed(feed.dateUpdated, feed.dateLastModified, responseLastModifiedDate)) {
    const decremented = handleFetchFeedSuccess(feed);
    if(decremented) {
      feed.dateUpdated = new Date();

      // TODO: use a channel
      await putFeed(this.feedConn, null, feed);


    }
    return 0;
  }

  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    console.debug(error);

    handlePollFeedError({
      error: error,
      conn: this.feedConn,
      feed: feed,
      category: 'read-response-body',
      threshold: this.deactivationThreshold,
      channel: this.channel
    });

    return 0;
  }

  assert(typeof feedXML === 'string');
  let parseResult;
  const processEntries = true;

  try {
    parseResult = coerceFeed(feedXML, requestURL, new URL(response.url),
      responseLastModifiedDate, processEntries);
  } catch(error) {
    console.debug('Error coercing feed with url', response.url, error);

    handlePollFeedError({
      error: error,
      conn: this.feedConn,
      feed: feed,
      category: 'parse-feed',
      threshold: this.deactivationThreshold,
      channel: this.channel
    });

    return 0;
  }

  const mergedFeed = mergeFeeds(feed, parseResult.feed);

  // If we did not exit earlier as a result of some kind of error, then we want to possibly
  // decrement the error count and save the updated error count, so that errors do not persist
  // indefinitely.
  handleFetchFeedSuccess(mergedFeed);

  // TODO: this could happen prior to merge? should it?
  const storableFeed = prepareFeed(mergedFeed);
  storableFeed.dateUpdated = new Date();

  await putFeed(this.feedConn, this.channel, storableFeed);

  const entries = parseResult.entries;
  cascadeFeedPropertiesToEntries(storableFeed, entries);

  const promises = entries.map(this.pollEntry, this);
  const entryIds = await Promise.all(promises);
  const numEntriesAdded = entryIds.filter(id => id > 0).length;

  if(!batched && numEntriesAdded > 0) {
    updateBadgeText();

    const title = 'Added articles';
    const message = 'Added articles for feed ' + storableFeed.title;
    showDesktopNotification(title, message);
  }

  return numEntriesAdded;
};

FeedPoll.prototype.didPollFeedRecently = function(feed) {
  if(this.ignoreRecencyCheck) {
    return false;
  }

  // Cannot assume a feed has ever been fetched, and therefore cannot assume dateFetched is set
  // If a feed has never been fetched, then it cannot have been polled recently.
  if(!(feed.dateFetched instanceof Date)) {
    return false;
  }

  const currentDate = new Date();
  const millisElapsed = currentDate - feed.dateFetched;

  // Be wary of a fetchDate in the future. This indicates the data has been corrupted or something
  // is wrong somewhere.
  if(millisElapsed < 0) {
    throw new Error('Cannot poll feed fetched in the future ' + feed);
  }

  return millisElapsed < this.recencyPeriodMs;
};

// Decrement error count if set and not 0. Return whether or not state changed.
function handleFetchFeedSuccess(feed) {
  if('errorCount' in feed) {
    if(typeof feed.errorCount === 'number') {
      if(feed.errorCount > 0) {
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

// TODO: new kind of problem, in hindsight, is merging of count of errors for parsing and fetching.
// suppose a feed file which is periodically updated becomes not-well-formed, causing parsing
// error. This is going to on the poll period update the error count. THis means that after a
// couple polls, the feed quickly becomes inactive. That would be desired for the fetch error
// count, maybe, but not for the parse error count. Because eventually the feed file will get
// updated again and probably become well formed again. I've actually witnessed this. So the issue
// is this prematurely deactivates feeds that happen to have a parsing error that is actually
// ephemeral (temporary) and not permanent.

// TODO: rather than try and update the database, perhaps it would be better to simply generate
// an event with feed id and some basic error information, and let some error handler handle
// the event at a later time. This removes all concern over encountering a closed database
// or closed channel at the time of the call to putFeed, and maintains the non-blocking
// characteristic.

function handlePollFeedError(errorContext) {
  assert(typeof errorContext === 'object' && 'conn' in errorContext);

  const error = errorContext.error;
  const conn = errorContext.conn;
  const feed = errorContext.feed;
  const callCategory = errorContext.category;
  const threshold = errorContext.threshold;
  const channel = errorContext.channel;

  assert(Number.isInteger(threshold));

  if(error instanceof OfflineError) {
    console.debug('Ignoring offline error', error);
    return;
  }

  if(error instanceof TimeoutError) {
    console.debug('Ignoring timeout error', error);
    return;
  }

  if(Number.isInteger(feed.errorCount)) {
    feed.errorCount++;
  } else {
    feed.errorCount = 1;
  }

  if(feed.errorCount > threshold) {
    console.debug('Error count exceeded threshold, deactivating feed', feed.id);
    feed.active = false;
    feed.deactivationReasonText = callCategory;
    feed.deactivationDate = new Date();
  }

  feed.dateUpdated = new Date();

  // Call putFeed in a non-blocking manner. Any errors are simply logged since we return
  // prior to this call settling. We still use the same database connection, because
  // the put request is dispatched immediately using the connection, which is preferred
  // to trying to use a completely separate connection.
  putFeed(conn, channel, feed).catch(console.error);
}

FeedPoll.prototype.isUnmodifiedFeed = function(feedUpdated, feedDate, responseDate) {
  if(this.ignoreModifiedCheck || !feedUpdated) {
    return false;
  }
  return feedDate && responseDate && feedDate.getTime() === responseDate.getTime();
};

function cascadeFeedPropertiesToEntries(feed, entries) {
  for(const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;

    if(feed.datePublished && !entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }
}

FeedPoll.prototype.pollEntry = async function(entry) {
  assert(this.feedConn instanceof IDBDatabase);
  assert(isEntry(entry));

  // Only entries with a url can be stored. However, we cannot make any assumptions about the
  // well-formedness of entries coming from the feed.
  if(!entryHasURL(entry)) {
    console.debug('Entry missing url', entry);
    return;
  }

  // This should never throw, so no try/catch. If it does throw it represents a programming error.
  let url = new URL(entryPeekURL(entry));

  const rewrittenURL = rewriteURL(url);
  if(rewrittenURL && url.href !== rewrittenURL.href) {
    entryAppendURL(entry, rewrittenURL);
    url = rewrittenURL;
  }

  // This should never fail except in case of a database error, so no try/catch
  let containsEntry = await containsEntryWithURL(this.feedConn, url);
  if(containsEntry) {
    return;
  }

  let entryContent = entry.content;

  // Try to fetch the entry's full text. Prevent errors from bubbling. Only fetch is the
  // content appears fetchable (e.g. not a pdf, paywalled)
  // TODO: revert fetchHML to throwing errors instead of status
  let response;
  if(isPollableURL(url)) {
    try {
      response = await fetchHTML(url, this.fetchHTMLTimeoutMs);
    } catch(error) {
      console.debug(error);
    }
  }

  let didFetchContent = false;
  if(response) {
    const responseURL = new URL(response.url);
    let redirectIsPollable = true;
    if(detectURLChanged(url, responseURL)) {

      if(!isPollableURL(responseURL)) {
        return;
      }

      containsEntry = await containsEntryWithURL(this.feedConn, responseURL);
      if(containsEntry) {
        console.debug('Entry already exists for url', responseURL.href);
        return;
      }

      entryAppendURL(entry, responseURL);

      url = responseURL;

      // TODO: attempt to rewrite the redirected url as well?

      // If we redirected, check if the redirect text is usable. For example, we redirected
      // from pollable html page to pdf. In that case should not consider response body.
      redirectIsPollable = isPollableURL(responseURL);
    }

    if(redirectIsPollable) {
      // Use the full text of the response in place of the in-feed content
      try {
        entryContent = await response.text();
        didFetchContent = true;
        //console.debug('Replaced entry content with fetched content for url', url.href);
      } catch(error) {
        console.debug(error);
      }
    } else {
      console.debug('Redirected url is not pollable', responseURL.href);
    }
  } else {
    console.debug('Entry has no fetched response', url.href);
  }

  // Parse the response's full text into an html document. Trap any errors.
  let entryDocument;
  try {
    entryDocument = parseHTML(entryContent);
  } catch(error) {
    console.debug(error);
    // Continue
  }

  // If the entry is untitled, try and use the fetched content to set its title
  if(!entry.title && didFetchContent && entryDocument) {
    const titleElement = entryDocument.querySelector('html > head > title');
    if(titleElement) {
      const titleText = titleElement.textContent;
      console.debug('Set missing entry title from fetched content', url.href, titleText);
      entry.title = titleText;
    }
  }

  await this.setEntryFavicon(entry, url, response ? entryDocument : undefined);

  // Filter the entry content
  if(entryDocument) {
    await applyAllDocumentFilters(entryDocument, url, this.fetchImageTimeoutMs);
    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }

  const storedEntry = await addEntry(this.feedConn, this.channel, entry);
  return storedEntry.id;
};

function isPollableURL(url) {
  return isHTTPURL(url) && !isBinaryURL(url) && !isInaccessibleContentURL(url);
}

FeedPoll.prototype.setEntryFavicon = async function(entry, url, document) {

  const query = {};
  query.conn = this.iconConn;
  query.skipURLFetch = true;
  query.url = url;
  query.document = document;

  // TODO: error suppression is part of control flow. I think control flow is clearer in
  // calling context. This should just throw on error and expect caller to deal with it.

  let iconURLString;
  try {
    iconURLString = await lookupFavicon(query);
    if(iconURLString) {
      entry.faviconURLString = iconURLString;
    }
  } catch(error) {
    console.debug(error);
  }
};

function isInaccessibleContentURL(url) {
  for(const desc of INACCESSIBLE_CONTENT_DESCRIPTORS) {
    if(desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function isHTTPURL(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function assert(value, message) {
  if(!value) throw new Error(message || 'Assertion error');
}
