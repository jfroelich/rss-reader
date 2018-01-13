import showDesktopNotification from "/src/notifications.js";
import assert from "/src/common/assert.js";
import * as FetchUtils from "/src/common/fetch-utils.js";
import formatString from "/src/common/format-string.js";
import {parseHTML} from "/src/common/html-utils.js";
import * as PromiseUtils from "/src/common/promise-utils.js";
import * as Status from "/src/common/status.js";
import {FaviconCache, FaviconService} from "/src/favicon-service/favicon-service.js";
import updateBadgeText from "/src/feed-ops/update-badge-text.js";
import applyAllDocumentFilters from "/src/feed-poll/filters/apply-all.js";
import rewriteURL from "/src/feed-poll/rewrite-url.js";
import isBinaryURL from "/src/feed-poll/is-binary-url.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
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
  this.feedStore;
  this.iconCache;
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
  assert(typeof this.feedStore === 'undefined' || this.feedStore === null);
  assert(typeof this.iconCache === 'undefined' || this.iconCache === null);
  this.feedStore = new FeedStore();
  this.iconCache = new FaviconCache();
};

FeedPoll.prototype.open = async function() {
  assert(this.feedStore instanceof FeedStore);
  assert(this.iconCache instanceof FaviconCache);
  assert(!this.feedStore.isOpen());
  assert(!this.iconCache.isOpen());
  assert(!this.channel);

  const promises = [this.feedStore.open(), this.iconCache.open()];
  await Promise.all(promises);
  const CHANNEL_NAME = 'reader';
  this.channel = new BroadcastChannel(CHANNEL_NAME);
};

FeedPoll.prototype.close = function() {
  if(this.channel)    this.channel.close();
  if(this.feedStore)  this.feedStore.close();
  if(this.iconCache)  this.iconCache.close();
};

FeedPoll.prototype.pollFeeds = async function() {
  assert(this.feedStore instanceof FeedStore);
  assert(this.feedStore.isOpen());
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(this.channel instanceof BroadcastChannel);

  const [status, feeds] = await this.feedStore.findActiveFeeds();
  if(status !== Status.OK) {
    console.error('Failed to load active feeds, status was', status);
    return status;
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
    updateBadgeText();
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
  assert(this.feedStore.isOpen());
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
    await handlePollFeedError(status, this.feedStore, feed, 'fetch-feed',
      this.deactivationThreshold);
  }

  const responseLastModifiedDate = FetchUtils.getLastModified(response);

  if(this.isUnmodifiedFeed(feed.dateUpdated, feed.dateLastModified, responseLastModifiedDate)) {
    const decremented = handleFetchFeedSuccess(feed);
    if(decremented) {
      feed.dateUpdated = new Date();
      [status] = await this.feedStore.putFeed(feed);
      if(status !== Status.OK) {
        throw new Error('Failed to put feed with status ' + status);
      }

    }
    return 0;
  }

  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    await handlePollFeedError(Status.EFETCH, this.feedStore, feed, 'read-response-body',
      this.deactivationThreshold);
  }

  assert(typeof feedXML === 'string');
  let parseResult;
  const processEntries = true;
  [status, parseResult] = coerceFeed(feedXML, requestURL, new URL(response.url),
    responseLastModifiedDate, processEntries);
  if(status !== Status.OK) {
    console.error('Coerce feed error:', Status.toString(status));
    await handlePollFeedError(Status.EPARSEFEED, this.feedStore, feed, 'parse-feed',
      this.deactivationThreshold);
    return;
  }

  const mergedFeed = Feed.merge(feed, parseResult.feed);

  // If we did not exit earlier as a result of some kind of error, then we want to possibly
  // decrement the error count and save the updated error count, so that errors do not persist
  // indefinitely.
  handleFetchFeedSuccess(mergedFeed);

  // TODO: this could happen prior to merge? should it?
  const storableFeed = this.feedStore.prepareFeed(mergedFeed);
  storableFeed.dateUpdated = new Date();
  [status] = await this.feedStore.putFeed(storableFeed);
  if(status !== Status.OK) {
    throw new Error('Failed to put feed with status ' + status);
  }

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

async function handlePollFeedError(errorCode, store, feed, callCategory, threshold) {

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
  const [status] = await store.putFeed(feed);
  if(status !== Status.OK) {
    throw new Error('Failed to put feed with status ' + status);
  }

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
  assert(this.feedStore.isOpen());
  assert(this.iconCache.isOpen());
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
  let containsEntry;
  [status, containsEntry] = await this.feedStore.containsEntryWithURL(url);
  if(status !== Status.OK) {
    console.error('Error checking contains entry with url', status);
    return;
  }

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

      [status, containsEntry] = await this.feedStore.containsEntryWithURL(responseURL);
      if(status !== Status.OK) {
        console.error('Error checking contains entry with url', status);
        return;
      }

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

  let entryId;
  [status, entryId] = await this.feedStore.addEntry(entry, this.channel);
  if(status !== Status.OK) {
    throw new Error('Failed to add entry, status is ' + status);
  }

  return entryId;
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

// Attempts to parse the fetched html. May return undefined
function parseEntryHTML(html) {
  const [status, document, message] = parseHTML(html);
  if(status !== Status.OK) {
    // Return undefined on parse error
    return;
  } else {
    return document;
  }
}

FeedPoll.prototype.setEntryFavicon = async function(entry, url, document) {
  const query = new FaviconService();
  query.cache = this.iconCache;
  query.skipURLFetch = true;

  const [status, iconURLString] = await query.lookup(url, document);
  if(status !== Status.OK) {
    console.error('Favicon lookup error:', Status.toString(status));
    return status;
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
