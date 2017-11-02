'use strict';

// import base/errors.js
// import net/fetch.js
// import poll/poll-entry.js
// import extension.js
// import feed.js
// import feed-coerce-from-response.js
// import reader-badge.js
// import reader-db.js
// import reader-storage.js

function PollFeedsContext() {
  this.readerConn = undefined;
  this.iconConn = undefined;
  this.allowMeteredConnections = false;
  this.ignoreRecencyCheck = false;
  this.ignoreIdleState = false;
  this.ignoreModifiedCheck = false;
  this.idlePeriodSecs = 30;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;

  // Whether to accept html when fetching a feed
  this.acceptHTML = true;
}

async function pollFeeds(pfc) {
  console.assert(pfc instanceof PollFeedsContext);
  console.log('pollFeeds start');

  if('onLine' in navigator && !navigator.onLine) {
    console.debug('offline');
    return false;
  }

  if(!pfc.allowMeteredConnections && 'NO_POLL_METERED' in localStorage &&
    navigator.connection && navigator.connection.metered) {
    console.debug('metered connection');
    return false;
  }

  if(!pfc.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    // TODO: call to wrapper function extensionIsIdle instead
    const state = await extensionIdleQuery(pfc.idlePeriodSecs);
    if(state !== 'locked' && state !== 'idle') {
      console.debug('idle');
      return false;
    }
  }

  let feeds;
  try {
    feeds = await readerDbGetFeeds(pfc.readerConn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  if(!pfc.ignoreRecencyCheck) {
    const pollableFeeds = [];
    for(const feed of feeds) {
      if(pollFeedsFeedIsPollable(feed, pfc.recencyPeriodMs)) {
        pollableFeeds.push(feed);
      }
    }
    feeds = pollableFeeds;
  }

  const promises = [];
  for(const feed of feeds) {
    promises.push(pollFeedsPollFeed(feed, pfc));
  }

  const statuses = await Promise.all(promises);

  let status = await readerUpdateBadge(pfc.readerConn);
  if(status !== RDR_OK) {
    console.warn('pollFeeds readerUpdateBadge failed with status', status);
  }

  const title = 'Added articles';
  const message = 'Added articles';
  extensionNotify(title, message);

  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();

  console.log('pollFeeds end');
  return RDR_OK;
}

function pollFeedsFeedIsPollable(feed, recencyPeriodMs) {
  // If we do not know when the feed was fetched, then assume it is a new feed
  // that has never been fetched
  if(!feed.dateFetched) {
    return true;
  }

  // The amount of time that has elapsed, in milliseconds, from when the
  // feed was last polled.
  const elapsed = new Date() - feed.dateFetched;
  if(elapsed < recencyPeriodMs) {
    // A feed has been polled too recently if not enough time has elasped from
    // the last time the feed was polled.
    console.debug('feed polled too recently', feedGetTopURL(feed));
    return false;
  }

  return true;
}

// @throws {Error} any exception thrown by fetchFeed
// @returns {status} status
async function pollFeedsPollFeed(feed, pfc) {
  console.assert(feedIsFeed(feed));
  console.assert(pfc instanceof PollFeedsContext);

  const url = feedGetTopURL(feed);

  let response;
  try {
    response = await fetchFeed(url, pfc.fetchFeedTimeoutMs, pfc.acceptHTML);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_FETCH;
  }

  // Check whether the feed was not modified since last update
  if(!pfc.ignoreModifiedCheck && feed.dateUpdated &&
    feed.dateLastModified && response.last_modified_date &&
    feed.dateLastModified.getTime() ===
    response.last_modified_date.getTime()) {

    console.debug('skipping unmodified feed', url, feed.dateLastModified,
      response.last_modified_date);
    return RDR_OK;
  }

  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    console.warn(error);
    return RDR_ERR_FETCH;
  }

  const PROCESS_ENTRIES = true;
  const parseResult = readerParseFeed(feedXML, url, response.responseURL,
    response.last_modified_date, PROCESS_ENTRIES);

  if(parseResult.status !== RDR_OK) {
    return parseResult.status;
  }

  const mergedFeed = feedMerge(feed, parseResult.feed);
  let storedFeed;
  try {
    storedFeed = await readerStoragePutFeed(mergedFeed, pfc.readerConn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  let entries = parseResult.entries;

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
  pec.iconConn = pfc.iconConn;
  pec.feedFaviconURL = storedFeed.faviconURLString;
  pec.fetchHTMLTimeoutMs = pfc.fetchHTMLTimeoutMs;
  pec.fetchImageTimeoutMs = pfc.fetchImageTimeoutMs;

  const entryPromises = entries.map(pollEntry, pec);
  const entryResolutions = await Promise.all(entryPromises);
  return RDR_OK;
}
