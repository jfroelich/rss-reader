// Module for polling feeds

import assert from "/src/assert.js";
import {queryIdleState, showNotification} from "/src/extension.js";
import {feedIsFeed, feedMerge, feedPeekURL} from "/src/feed.js";
import {fetchFeed} from "/src/fetch.js";
import {pollEntry, PollEntryContext} from "/src/poll-entry.js";
import {promiseEvery} from "/src/promise.js";
import {readerBadgeUpdate} from "/src/reader-badge.js";
import {readerDbGetFeeds} from "/src/rdb.js";
import {readerParseFeed} from "/src/reader-parse-feed.js";
import {readerStoragePutFeed} from "/src/reader-storage.js";

// TODO: rename pollFeeds to poll?
// TODO: rather than context, just create a function option like
// PollFeedOperation, or PollFeedRequest or something like this? Then
// deprecate PollFeedsContext?

// The icon cache dependency should be implicit. cache should be a property of a
// pollFeeds-like object.


export function PollFeedsContext() {
  this.readerConn = undefined;
  this.iconCache = undefined;
  this.allowMeteredConnections = false;
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

export async function pollFeeds(pfc) {
  assert(pfc instanceof PollFeedsContext);
  assert('onLine' in navigator);
  if(!navigator.onLine) {
    console.debug('offline');
    return;
  }

  if(!pfc.allowMeteredConnections && 'NO_POLL_METERED' in localStorage && navigator.connection &&
    navigator.connection.metered) {
    console.debug('metered connection');
    return;
  }

  if(!pfc.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await queryIdleState(pfc.idlePeriodSecs);
    if(state !== 'locked' && state !== 'idle') {
      console.debug('idle');
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

  // TODO: pfc should be this bound?
  const promises = [];
  for(const feed of feeds) {
    promises.push(pollFeed(feed, pfc));
  }
  await promiseEvery(promises);

  await readerBadgeUpdate(pfc.readerConn);

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

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recencyPeriodMs) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    console.debug('feed polled too recently', feedPeekURL(feed));
    return false;
  }

  return true;
}

async function pollFeed(feed, pfc) {
  assert(feedIsFeed(feed));
  assert(pfc instanceof PollFeedsContext);

  const url = feedPeekURL(feed);
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
  const parseResult = readerParseFeed(feedXML, url, response.responseURL, response.lastModifiedDate,
    PROCESS_ENTRIES);

  const mergedFeed = feedMerge(feed, parseResult.feed);
  const storedFeed = await readerStoragePutFeed(mergedFeed, pfc.readerConn);
  const entries = parseResult.entries;

  // Cascade feed properties to entries
  for(const entry of entries) {
    entry.feed = storedFeed.id;
    entry.feedTitle = storedFeed.title;
    if(!entry.datePublished) {
      entry.datePublished = storedFeed.datePublished;
    }
  }

  const pec = new PollEntryContext();
  pec.readerConn = pfc.readerConn;
  pec.iconCache = pfc.iconCache;
  pec.feedFaviconURL = storedFeed.faviconURLString;
  pec.fetchHTMLTimeoutMs = pfc.fetchHTMLTimeoutMs;
  pec.fetchImageTimeoutMs = pfc.fetchImageTimeoutMs;

  const entryPromises = entries.map(pollEntry, pec);

  // TODO: switch to using promiseEvery?
  const entryResolutions = await Promise.all(entryPromises);
}
