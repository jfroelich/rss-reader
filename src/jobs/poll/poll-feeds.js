import assert from "/src/assert/assert.js";
import * as Config from "/src/config.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {OfflineError} from "/src/fetch/errors.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import fetchHTML from "/src/fetch/fetch-html.js";
import applyAllDocumentFilters from "/src/filters/apply-all.js";
import sniffIsBinaryURL from "/src/jobs/poll/sniff.js";
import rewriteURL from "/src/jobs/poll/rewrite-url.js";
import {TimeoutError} from "/src/operations/timed-operation.js";
import {showNotification} from "/src/platform/platform.js";
import parseFeed from "/src/reader/parse-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import check from "/src/utils/check.js";
import parseHTML from "/src/utils/html/parse.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import {promiseEvery} from "/src/utils/promise-utils.js";
import {setURLHrefProperty} from "/src/utils/url-utils.js";
import {isValidURLString} from "/src/utils/url-string-utils.js";

// TODO: think of a better name for the class

export default function PollFeeds() {
  this.feedStore;
  this.iconCache;
  this.ignoreRecencyCheck = false;
  this.ignoreModifiedCheck = false;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;
  this.extendedFeedTypes = [
    'application/octet-stream',
    'text/html'
  ];
  this.batchMode = false;
  this.channel = null;
}

PollFeeds.prototype.init = function() {
  assert(typeof this.feedStore === 'undefined' || this.feedStore === null);
  assert(typeof this.iconCache === 'undefined' || this.iconCache === null);
  this.feedStore = new FeedStore();
  this.iconCache = new FaviconCache();
};

PollFeeds.prototype.open = async function() {
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

PollFeeds.prototype.close = function() {
  if(this.channel)    this.channel.close();
  if(this.feedStore)  this.feedStore.close();
  if(this.iconCache)  this.iconCache.close();
};

PollFeeds.prototype.pollFeeds = async function() {
  assert(this.feedStore instanceof FeedStore);
  assert(this.feedStore.isOpen());
  assert(this.iconCache instanceof FaviconCache);
  assert(this.iconCache.isOpen());
  assert(this.channel instanceof BroadcastChannel);

  const feeds = await this.feedStore.findActiveFeeds();

  // TODO: this should be param to pollFeed not a property
  // TODO: rename to batched
  this.batchMode = true;

  const promises = feeds.map(this.pollFeed, this);
  const pollFeedResolutions = await promiseEvery(promises);

  let totalNumEntriesAdded = 0;
  for(const res of pollFeedResolutions) {
    if(res) {
      totalNumEntriesAdded += res;
    }
  }

  if(totalNumEntriesAdded > 0) {
    await updateBadgeText(this.feedStore);
  }

  if(totalNumEntriesAdded > 0) {
    const title = 'Added articles';
    const message = 'Added articles';
    showNotification(title, message);
  }
};

// TODO: to enforce that the feed parameter is a feed object loaded from the database, it is
// possible that pollFeed would be better implemented if it instead accepted a feedId as a
// parameter, and loaded the feed here. That would guarantee the feed it works with is more trusted
// regarding the locally loaded issue.

// TODO: make this an instance property
const FEED_ERROR_COUNT_DEACTIVATION_THRESHOLD = 10;

PollFeeds.prototype.pollFeed = async function(feed) {
  assert(this.feedStore.isOpen());
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const url = Feed.peekURL(feed);
  console.log('Polling feed', url);

  if(this.didPollFeedRecently(feed)) {
    return 0;
  }

  const requestURL = new URL(url);
  let response;
  try {
    response = await fetchFeed(requestURL, this.fetchFeedTimeoutMs, this.extendedFeedTypes);
  } catch(error) {
    await handlePollFeedError(error, this.feedStore, feed, 'fetch-feed');
  }

  assert(typeof response === 'object');

  const errorCountChanged = handleFetchFeedSuccess(feed);

  if(this.isUnmodifiedFeed(feed, response)) {
    if(errorCountChanged) {
      feed.dateUpdated = new Date();
      await this.feedStore.putFeed(feed);
    }
    return 0;
  }

  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    await handlePollFeedError(error, this.feedStore, feed, 'read-response-body');
  }

  assert(typeof feedXML === 'string');
  let parseResult;
  const PROCESS_ENTRIES = true;
  try {
    parseResult = parseFeed(feedXML, url, response.responseURL, response.lastModifiedDate,
      PROCESS_ENTRIES);
  } catch(error) {
    await handlePollFeedError(error, this.feedStore, feed, 'parse-feed');
  }

  const mergedFeed = Feed.merge(feed, parseResult.feed);
  // TODO: this could happen prior to merge? should it?
  const storableFeed = this.feedStore.prepareFeed(mergedFeed);
  storableFeed.dateUpdated = new Date();
  await this.feedStore.putFeed(storableFeed);

  const entries = parseResult.entries;
  cascadeFeedPropertiesToEntries(storableFeed, entries);
  const numEntriesAdded = await this.pollEntries(storableFeed, entries);

  if(!this.batchMode && numEntriesAdded > 0) {
    await updateBadgeText(this.feedStore);
  }

  if(!this.batchMode && numEntriesAdded > 0) {
    // TODO: use more specific title and message given that this is about a feed
    const title = 'Added articles for feed';
    const message = 'Added articles for feed';
    showNotification(title, message);
  }

  return numEntriesAdded;
};

PollFeeds.prototype.didPollFeedRecently = function(feed) {
  if(this.ignoreRecencyCheck) {
    return false;
  }

  // If a feed has never been fetched, then it cannot have been polled recently.
  if(!(feed.dateFetched instanceof Date)) {
    return false;
  }

  const currentDate = new Date();
  const elapsedSinceLastPollMs = currentDate - feed.dateFetched;

  // TODO: data integrity errors are expected?
  assert(elapsedSinceLastPollMs >= 0);

  if(elapsedSinceLastPollMs < this.recencyPeriodMs) {
    return true;
  }

  return false;
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

async function handlePollFeedError(error, store, feed, callCategory) {
  if(isUncheckedError(error)) {
    throw error;
  }

  if(callCategory === 'fetch-feed' && error instanceof OfflineError) {
    throw error;
  }

  if(callCategory === 'fetch-feed' && error instanceof TimeoutError) {
    console.debug('Ignoring timeout error in slow network environment');
    throw error;
  }

  const priorErrorCount = feed.errorCount;
  if(Number.isInteger(feed.errorCount)) {
    feed.errorCount++;
  } else {
    feed.errorCount = 1;
  }

  if(feed.errorCount > FEED_ERROR_COUNT_DEACTIVATION_THRESHOLD) {
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
  await store.putFeed(feed);
  throw error;
}

PollFeeds.prototype.isUnmodifiedFeed = function(feed, response) {
  if(this.ignoreModifiedCheck) {
    return false;
  }

  // Pretend the feed is modified
  if(!feed.dateUpdated) {
    return false;
  }

  if(!feed.dateLastModified) {
    return false;
  }

  if(!response.lastModifiedDate) {
    return false;
  }

  // Otherwise, if the two dates match then the feed was not modified.
  if(feed.dateLastModified.getTime() === response.lastModifiedDate.getTime()) {
    //console.debug('Feed not modified', Feed.peekURL(feed), feed.dateLastModified,
    //  response.lastModifiedDate);
    return true;
  }

  return false;
};

function cascadeFeedPropertiesToEntries(feed, entries) {
  assert(Feed.isValidId(feed.id));

  for(const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
  }

  if(feed.datePublished) {
    for(const entry of entries) {
      if(!entry.datePublished) {
        entry.datePublished = feed.datePublished;
      }
    }
  }
}

PollFeeds.prototype.pollEntries = async function(feed, entries) {
  const promises = [];
  for(const entry of entries) {
    promises.push(this.pollEntry(entry, feed.faviconURLString));
  }

  const resolutions = await promiseEvery(promises);

  let numEntriesAdded = 0;
  for(const resolution of resolutions) {
    if(resolution) {
      numEntriesAdded++;
    }
  }

  return numEntriesAdded;
};

PollFeeds.prototype.pollEntry = async function(entry, fallbackFaviconURLString) {
  assert(this.feedStore.isOpen());
  assert(this.iconCache.isOpen());
  assert(Entry.isEntry(entry));

  // Cannot assume the entry has a url (not an error). A url is required
  if(!Entry.hasURL(entry)) {
    return;
  }

  const url = new URL(Entry.peekURL(entry));
  const rewrittenURL = rewriteURL(url.href);
  if(rewrittenURL && url.href !== rewrittenURL) {
    Entry.appendURL(entry, rewrittenURL);
    setURLHrefProperty(url, rewrittenURL);
  }

  if(!isHTTPURL(url) || isInaccessibleContentURL(url) || sniffIsBinaryURL(url)) {
    return;
  }

  if(await this.feedStore.findEntryIdByURL(url.href)) {
    return;
  }

  let entryContent = entry.content;

  let response;
  try {
    response = await fetchHTML(url, this.fetchHTMLTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, not fatal, will fallback to local content
    }
  }

  if(response) {
    if(response.redirected) {
      const responseURL = new URL(response.responseURL);
      if(!isHTTPURL(responseURL) || isInaccessibleContentURL(responseURL) ||
        sniffIsBinaryURL(responseURL)) {
        return;
      }

      if(await this.feedStore.findEntryIdByURL(responseURL.href)) {
        return;
      }

      Entry.appendURL(entry, response.responseURL);

      // TODO: attempt to rewrite the redirected url as well?
      setURLHrefProperty(url, response.responseURL);
    }

    // Use the full text of the response in place of the in-feed content
    entryContent = await response.text();
  }

  let entryDocument;
  try {
    entryDocument = parseHTML(entryContent);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, not fatal
    }
  }

  // Lookup and set the entry's favicon
  let iconURLString;
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  // Only use the document for lookup if it was fetched
  const lookupDocument = response ? entryDocument : undefined;
  try {
    iconURLString = await query.lookup(url, lookupDocument);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    } else {
      // Ignore, not fatal
    }
  }
  entry.faviconURLString = iconURLString || fallbackFaviconURLString;

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

  const newEntryId = await this.feedStore.addEntry(entry, this.channel);
  return newEntryId;
}

function isInaccessibleContentURL(url) {
  for(const desc of Config.INACCESSIBLE_CONTENT_DESCRIPTORS) {
    if(desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function isHTTPURL(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}
