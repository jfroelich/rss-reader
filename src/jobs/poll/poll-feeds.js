import assert from "/src/assert.js";
import {queryIdleState, showNotification} from "/src/extension.js";
import * as Feed from "/src/storage/feed.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import * as PollEntryModule from "/src/jobs/poll/poll-entry.js";
import {promiseEvery} from "/src/utils/promise.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import {getFeeds as readerDbGetFeeds} from "/src/storage/rdb.js";
import parseFeed from "/src/reader/parse-feed.js";
import feedPut from "/src/storage/feed-put.js";

export function PollFeedsContext() {
  this.readerConn = undefined;
  this.iconCache = undefined;
  this.ignoreRecencyCheck = false;
  this.ignoreIdleState = false;
  this.ignoreModifiedCheck = false;
  this.idlePeriodSecs = 30;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;
  this.acceptHTML = true;
}

// TODO: pfc should be this bound?

export async function pollFeeds(pfc) {
  assert(pfc instanceof PollFeedsContext);

  if(!pfc.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await queryIdleState(pfc.idlePeriodSecs);
    if(state !== 'locked' && state !== 'idle') {
      console.debug('polling canceled because not idle');
      return;
    }
  }

  let feeds = await readerDbGetFeeds(pfc.readerConn);

  if(!pfc.ignoreRecencyCheck) {
    const pollableFeeds = [];
    for(const feed of feeds) {
      if(isPollableFeed(feed, pfc.recencyPeriodMs)) {
        pollableFeeds.push(feed);
      }
    }
    feeds = pollableFeeds;
  }

  const promises = [];
  for(const feed of feeds) {
    promises.push(pollFeed(feed, pfc));
  }
  await promiseEvery(promises);

  await updateBadgeText(pfc.readerConn);

  const title = 'Added articles';
  const message = 'Added articles';
  showNotification(title, message);

  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();
}

function isPollableFeed(feed, recencyPeriodMs) {
  if(!feed.dateFetched) {
    return true;
  }

  // The amount of time that has elapsed, in milliseconds, from when the feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recencyPeriodMs) {
    // A feed has been polled too recently if not enough time has elasped from the last time the
    // feed was polled.
    console.debug('feed polled too recently', Feed.peekURL(feed));
    return false;
  }

  return true;
}

async function pollFeed(feed, pfc) {
  assert(Feed.isFeed(feed));
  assert(pfc instanceof PollFeedsContext);

  const url = Feed.peekURL(feed);

  // TODO: perhaps this check should be delegated to fetchFeed, which throws some type of
  // OfflineError or FetchError
  if(!navigator.onLine) {
    console.debug('failed to fetch feed %s while offline', url);
    return;
  }

  const response = await fetchFeed(url, pfc.fetchFeedTimeoutMs, pfc.acceptHTML);

  if(!pfc.ignoreModifiedCheck && feed.dateUpdated && feed.dateLastModified &&
    response.lastModifiedDate && feed.dateLastModified.getTime() ===
    response.lastModifiedDate.getTime()) {
    console.debug('skipping unmodified feed', url, feed.dateLastModified,
      response.lastModifiedDate);
    return;
  }

  const feedXML = await response.text();
  const PROCESS_ENTRIES = true;
  const parseResult = parseFeed(feedXML, url, response.responseURL, response.lastModifiedDate,
    PROCESS_ENTRIES);

  const mergedFeed = Feed.merge(feed, parseResult.feed);
  const storedFeed = await feedPut(mergedFeed, pfc.readerConn);
  const entries = parseResult.entries;

  // Cascade feed properties to entries
  for(const entry of entries) {
    entry.feed = storedFeed.id;
    entry.feedTitle = storedFeed.title;
    if(!entry.datePublished) {
      entry.datePublished = storedFeed.datePublished;
    }
  }

  const pec = new PollEntryModule.Context();
  pec.readerConn = pfc.readerConn;
  pec.iconCache = pfc.iconCache;
  pec.feedFaviconURL = storedFeed.faviconURLString;
  pec.fetchHTMLTimeoutMs = pfc.fetchHTMLTimeoutMs;
  pec.fetchImageTimeoutMs = pfc.fetchImageTimeoutMs;
  const pollEntryPromises = entries.map(PollEntryModule.pollEntry, pec);
  await promiseEvery(pollEntryPromises);
}
