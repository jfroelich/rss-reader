import showDesktopNotification from "/src/notifications.js";
import assert from "/src/common/assert.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import formatString from "/src/common/format-string.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as PromiseUtils from "/src/common/promise-utils.js";
import * as Status from "/src/common/status.js";

import {lookup, open as openIconStore} from "/src/favicon-service/favicon-service.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import applyAllDocumentFilters from "/src/feed-poll/filters/apply-all.js";
import rewriteURL from "/src/feed-poll/rewrite-url.js";
import isBinaryURL from "/src/feed-poll/is-binary-url.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";

import {
  addEntry,
  containsEntryWithURL,
  findActiveFeeds,
  open as openFeedStore,
  prepareFeed,
  putFeed
} from "/src/feed-store/feed-store.js";

import coerceFeed from "/src/coerce-feed.js";

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
  this.ignoreRecencyCheck = false;
  this.ignoreModifiedCheck = false;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;
  this.deactivationThreshold = 10;
  this.channel = null;
}

FeedPoll.prototype.init = function() {
  assert(!this.feedConn);
  assert(!this.iconConn);

  this.feedConn = null;
  this.iconConn = null;
};

FeedPoll.prototype.open = async function() {
  assert(!this.iconConn);
  assert(!this.feedConn);
  assert(!this.channel);

  const promises = [openFeedStore(), openIconStore()];
  [this.feedConn, this.iconConn] = await Promise.all(promises);

  // TODO: channel name should be defined externally, as an instance prop or parameter
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

  let feeds;
  try {
    feeds = await findActiveFeeds(this.feedConn);
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  const batched = true;
  const promises = [];
  for(const feed of feeds) {
    promises.push(this.pollFeed(feed, batched));
  }
  const resolutions = await PromiseUtils.promiseEvery(promises);
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

  return Status.OK;
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
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const feedURLString = Feed.peekURL(feed);
  console.log('Polling feed', feedURLString);

  if(!feed.active) {
    return 0;
  }

  if(this.didPollFeedRecently(feed)) {
    return 0;
  }

  const requestURL = new URL(feedURLString);
  let status, response;
  [status, response] = await FetchUtils.fetchFeed(requestURL, this.fetchFeedTimeoutMs);
  if(status !== Status.OK) {

    // TODO: this throws so there is no explicit return. I'd rather just return.
    await handlePollFeedError(status, this.feedConn, feed, 'fetch-feed',
      this.deactivationThreshold);
  }

  const responseLastModifiedDate = FetchUtils.getLastModified(response);

  if(this.isUnmodifiedFeed(feed.dateUpdated, feed.dateLastModified, responseLastModifiedDate)) {
    const decremented = handleFetchFeedSuccess(feed);
    if(decremented) {
      feed.dateUpdated = new Date();

      // TODO: use a channel
      // TODO: is try/catch needed?
      try {
        await putFeed(this.feedConn, null, feed);
      } catch(error) {
        console.error(error);
        return Status.EDB;
      }

    }
    return 0;
  }

  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    await handlePollFeedError(Status.EFETCH, this.feedConn, feed, 'read-response-body',
      this.deactivationThreshold);
  }

  assert(typeof feedXML === 'string');
  let parseResult;
  const processEntries = true;
  [status, parseResult] = coerceFeed(feedXML, requestURL, new URL(response.url),
    responseLastModifiedDate, processEntries);
  if(status !== Status.OK) {
    console.error('Coerce feed error:', Status.toString(status));
    await handlePollFeedError(Status.EPARSEFEED, this.feedConn, feed, 'parse-feed',
      this.deactivationThreshold);
    return;
  }

  const mergedFeed = Feed.merge(feed, parseResult.feed);

  // If we did not exit earlier as a result of some kind of error, then we want to possibly
  // decrement the error count and save the updated error count, so that errors do not persist
  // indefinitely.
  handleFetchFeedSuccess(mergedFeed);

  // TODO: this could happen prior to merge? should it?
  const storableFeed = prepareFeed(mergedFeed);
  storableFeed.dateUpdated = new Date();

  // TODO: use a channel
  await putFeed(this.feedConn, null, storableFeed);

  const entries = parseResult.entries;
  cascadeFeedPropertiesToEntries(storableFeed, entries);

  const promises = entries.map(this.pollEntry, this);
  const entryIds = await PromiseUtils.promiseEvery(promises);
  const numEntriesAdded = entryIds.filter(id => id > 0).length;

  if(!batched && numEntriesAdded > 0) {
    updateBadgeText();

    // TODO: use more specific title and message given that this is about a feed
    const title = 'Added articles for feed';
    const message = 'Added articles for feed';
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
  const elapsedSinceLastPollMs = currentDate - feed.dateFetched;

  // Be wary of a fetchDate in the future. This indicates the data has been corrupted or something
  // is wrong somewhere.
  if(elapsedSinceLastPollMs < 0) {
    const message = formatString('Cannot poll feed fetched in the future', feed);
    throw new Error(message);
  }

  return elapsedSinceLastPollMs < this.recencyPeriodMs;
};

// Decrement error count if set and not 0
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

async function handlePollFeedError(errorCode, conn, feed, callCategory, threshold) {

  if(callCategory === 'fetch-feed' && errorCode === Status.EOFFLINE) {
    throw new Error('Offline');
  }

  if(callCategory === 'fetch-feed' && errorCode === Status.ETIMEOUT) {
    console.debug('Ignoring timeout error in slow network environment');
    throw new Error('Fetch timed out');
  }

  if(Number.isInteger(feed.errorCount)) {
    feed.errorCount++;
  } else {
    feed.errorCount = 1;
  }

  assert(Number.isInteger(threshold));
  if(feed.errorCount > threshold) {
    console.debug('Error count exceeded threshold, deactivating feed', feed.id, Feed.peekURL(feed));
    feed.active = false;
    if(typeof callCategory !== 'undefined') {
      feed.deactivationReasonText = callCategory;
    }
    feed.deactivationDate = new Date();
  }

  // TODO: maybe this should be independent (concurrent)? Right now this benefits from using the
  // same shared connection. It isn't too bad in the sense that the success path also has a
  // blocking call when storing the feed. However, it feels like it shouldn't need to block. But
  // non-blocking seems a bit complex at the moment, so just getting it working for now.
  // NOTE: this can also throw, and thereby mask the error, but I suppose that is ok, because
  // both are errors, and in this case I suppose the db error trumps the fetch error
  feed.dateUpdated = new Date();

  let nullChannel;
  await putFeed(conn, nullChannel, feed);

  throw new Error('Poll error: ' + errorCode);
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
  assert(Entry.isEntry(entry));

  // Cannot assume the entry has a url (not an error). A url is required
  if(!Entry.hasURL(entry)) {
    return;
  }

  const url = new URL(Entry.peekURL(entry));
  const rewrittenURL = rewriteURL(url);
  if(rewrittenURL && url.href !== rewrittenURL.href) {
    Entry.appendURL(entry, rewrittenURL);
    setURLHrefProperty(url, rewrittenURL.href);
  }

  if(!isPollableURL(url)) {
    return;
  }

  let status;

  // This should never fail except in case of serious database error, so no try/catch
  let containsEntry = await containsEntryWithURL(this.feedConn, url);
  if(containsEntry) {
    return;
  }

  let entryContent = entry.content;
  const response = await this.fetchEntryHTML(url);

  if(response) {
    const responseURL = new URL(response.url);
    if(FetchUtils.detectURLChanged(url, responseURL)) {

      if(!isPollableURL(responseURL)) {
        return;
      }

      containsEntry = await containsEntryWithURL(this.feedConn, responseURL);
      if(containsEntry) {
        return;
      }

      Entry.appendURL(entry, responseURL);

      // TODO: attempt to rewrite the redirected url as well?
      setURLHrefProperty(url, response.url);
    }

    // Use the full text of the response in place of the in-feed content
    entryContent = await response.text();
  }

  const entryDocument = parseEntryHTML(entryContent);
  await this.setEntryFavicon(entry, url, response ? entryDocument : undefined);

  // TODO: if entry.title is undefined, try and extract it from entryDocument title element
  // For that matter, the whole 'set-entry-title' component should be abstracted into its own
  // module that deals with the concerns of the variety of sources for an entry?

  // Filter the entry content
  if(entryDocument) {
    await applyAllDocumentFilters(entryDocument, url, this.fetchImageTimeoutMs);
    entry.content = entryDocument.documentElement.outerHTML.trim();
  } else {
    entry.content = 'Empty or malformed content';
  }


  // TODO: if addEntry does not throw in the normal case, then the try catch here
  // isn't necessary. Unsure at the moment.

  let storedEntry;
  try {
    storedEntry = await addEntry(this.feedConn, this.channel, entry);
  } catch(error) {
    console.error(error);
    return;
  }

  return storedEntry.id;
};

function isPollableURL(url) {
  return isHTTPURL(url) && !isBinaryURL(url) && !isInaccessibleContentURL(url);
}

// TODO: with status, this is now pretty simple, just inline
// Attempts to fetch the entry's html. May return undefined.
FeedPoll.prototype.fetchEntryHTML = async function(url) {
  const [status, response] = await FetchUtils.fetchHTML(url, this.fetchHTMLTimeoutMs);
  return status === Status.OK ? response : null;
};

// TODO: this is now pretty simple without exceptions. Consider inlining.
// Attempts to parse the fetched html. May return undefined
function parseEntryHTML(html) {
  const [status, document, message] = parseHTML(html);
  if(status !== Status.OK) {
    console.debug(message);
    // Return undefined on parse error
    return;
  } else {
    return document;
  }
}

FeedPoll.prototype.setEntryFavicon = async function(entry, url, document) {

  const query = {};
  query.conn = this.iconConn;
  query.skipURLFetch = true;
  query.url = url;
  query.document = document;

  let iconURLString;
  try {
    iconURLString = await lookup(query);
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  if(iconURLString) {
    entry.faviconURLString = iconURLString;
  }
  return Status.OK;
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

// TODO: deprecate
function setURLHrefProperty(url, newHrefString) {
  const guardURL = new URL(newHrefString);
  url.href = guardURL.href;
}
