'use strict';

// import base/assert.js
// import base/errors.js
// import net/fetch.js
// import poll/poll-entry.js
// import extension.js
// import feed.js
// import reader-badge.js
// import reader-db.js
// import reader-parse-feed.js
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
  this.acceptHTML = true;
}

async function pollFeeds(pfc) {
  assert(pfc instanceof PollFeedsContext);
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

  let feeds = await readerDbGetFeeds(pfc.readerConn);

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
  // TODO: use promiseEvery? But what about assertion errors?
  await Promise.all(promises);

  await readerBadgeUpdate(pfc.readerConn);

  const title = 'Added articles';
  const message = 'Added articles';
  extensionNotify(title, message);

  const channel = new BroadcastChannel('poll');
  channel.postMessage('completed');
  channel.close();

  console.log('pollFeeds end');
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
    console.debug('feed polled too recently', feedPeekURL(feed));
    return false;
  }

  return true;
}

// @throws {AssertionError}
// @throws {Error} any exception thrown by fetchFeed
// @throws {ParserError}
// @throws {Error} any exception calling response.text()
// @throws {Error} database error
async function pollFeedsPollFeed(feed, pfc) {
  assert(feedIsFeed(feed));
  assert(pfc instanceof PollFeedsContext);

  const url = feedPeekURL(feed);

  // Allow exceptions to bubble
  const response = await fetchFeed(url, pfc.fetchFeedTimeoutMs, pfc.acceptHTML);

  if(!pfc.ignoreModifiedCheck && feed.dateUpdated && feed.dateLastModified &&
    response.lastModifiedDate && feed.dateLastModified.getTime() ===
    response.lastModifiedDate.getTime()) {
    console.debug('skipping unmodified feed', url, feed.dateLastModified,
      response.lastModifiedDate);
    return;
  }

  // Allow errors to bubble
  const feedXML = await response.text();

  const PROCESS_ENTRIES = true;

  // Allow errors to bubble
  const parseResult = readerParseFeed(feedXML, url, response.responseURL,
    response.lastModifiedDate, PROCESS_ENTRIES);

  const mergedFeed = feedMerge(feed, parseResult.feed);

  // Allow errors to bubble
  const storedFeed = await readerStoragePutFeed(mergedFeed, pfc.readerConn);

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
}
