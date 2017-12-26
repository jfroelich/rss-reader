import assert from "/src/utils/assert.js";
import * as Config from "/src/config.js";
import FaviconCache from "/src/favicon/cache.js";
import FaviconLookup from "/src/favicon/lookup.js";
import rewriteURL from "/src/feed-poll/rewrite-url.js";
import isBinaryURL from "/src/feed-poll/is-binary-url.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";
import FeedStore from "/src/feed-store/feed-store.js";
import {OfflineError} from "/src/fetch/errors.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import fetchHTML from "/src/fetch/fetch-html.js";
import applyAllDocumentFilters from "/src/filters/apply-all.js";
import TimeoutError from "/src/utils/timeout-error.js";
import * as Platform from "/src/platform/platform.js";
import parseFeed from "/src/reader/parse-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import formatString from "/src/utils/format-string.js";
import parseHTML from "/src/utils/html/parse.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import * as URLUtils from "/src/utils/url-utils.js";

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
  this.extendedFeedTypes = [
    'application/octet-stream',
    'text/html'
  ];
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

  const feeds = await this.feedStore.findActiveFeeds();
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
    Platform.showNotification(title, message);
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
  assert(this.feedStore.isOpen());
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const url = Feed.peekURL(feed);
  console.log('Polling feed', url);

  if(!feed.active) {
    return 0;
  }

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

  if(this.isUnmodifiedFeed(feed.dateUpdated, feed.dateLastModified, response.lastModifiedDate)) {
    // Check if error count decremented as a result of successful fetch, in which case we still
    // need to update the feed object in the database despite exiting early.
    const decremented = handleFetchFeedSuccess(feed);
    if(decremented) {
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

  // If we did not exit earlier as a result of some kind of error, then we want to possibly
  // decrement the error count and save the updated error count, so that errors do not persist
  // indefinitely.
  handleFetchFeedSuccess(mergedFeed);

  // TODO: this could happen prior to merge? should it?
  const storableFeed = this.feedStore.prepareFeed(mergedFeed);
  storableFeed.dateUpdated = new Date();
  await this.feedStore.putFeed(storableFeed);

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
    Platform.showNotification(title, message);
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

  if(Number.isInteger(feed.errorCount)) {
    feed.errorCount++;
  } else {
    feed.errorCount = 1;
  }

  assert(Number.isInteger(this.deactivationThreshold));
  if(feed.errorCount > this.deactivationThreshold) {
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
  const rewrittenURL = rewriteURL(url.href);
  if(rewrittenURL && url.href !== rewrittenURL) {
    Entry.appendURL(entry, rewrittenURL);
    URLUtils.setURLHrefProperty(url, rewrittenURL);
  }

  if(!isPollableURL(url)) {
    return;
  }

  if(await this.feedStore.containsEntryWithURL(url)) {
    return;
  }

  let entryContent = entry.content;
  const response = await this.fetchEntryHTML(url);

  if(response) {
    if(response.redirected) {
      const responseURL = new URL(response.responseURL);
      if(!isPollableURL(responseURL)) {
        return;
      }

      if(await this.feedStore.containsEntryWithURL(responseURL)) {
        return;
      }

      Entry.appendURL(entry, response.responseURL);

      // TODO: attempt to rewrite the redirected url as well?
      URLUtils.setURLHrefProperty(url, response.responseURL);
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

  // Return the result of addEntry, which is the new entry's id
  return await this.feedStore.addEntry(entry, this.channel);
};

function isPollableURL(url) {
  return isHTTPURL(url) && !isBinaryURL(url) && !isInaccessibleContentURL(url);
}

// Attempts to fetch the entry's html. May return undefined.
FeedPoll.prototype.fetchEntryHTML = async function(url) {
  let response;
  try {
    response = await fetchHTML(url, this.fetchHTMLTimeoutMs);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    }
  }
  return response;
};

// Attempts to parse the fetched html. May return undefined
function parseEntryHTML(html) {
  try {
    return parseHTML(html);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    }
  }
}

FeedPoll.prototype.setEntryFavicon = async function(entry, url, document) {
  const query = new FaviconLookup();
  query.cache = this.iconCache;
  query.skipURLFetch = true;
  try {
    const iconURLString = await query.lookup(url, document);
    if(iconURLString) {
      entry.faviconURLString = iconURLString;
    }
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    }
  }
};

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
