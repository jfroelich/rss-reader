import assert from "/src/assert.js";
import {queryIdleState, showNotification} from "/src/extension.js";
import * as Feed from "/src/reader-db/feed.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import * as PollEntryModule from "/src/jobs/poll/poll-entry.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import getFeedsFromDb from "/src/reader-db/get-feeds.js";
import parseFeed from "/src/reader/parse-feed.js";
import putFeed from "/src/reader-db/put-feed.js";
import promiseEvery from "/src/utils/promise-every.js";

// TODO: in order to make pollFeed directly callable, it needs to still be able to send a
// notification when finished. Right now, I send one notification when polling all feeds. So there
// are basically 2-3 modes: notify once for all feeds, notify per feed, do not notify.

// TODO: sending a BroadcastChannel message when polling completes is pointless. The event is not
// significant because it represents too many things that may have just happened. This should
// only be broadcasting interesting, granular events. For example, when an entry is added, or
// when a feed's details change in the database or something. Furthermore, the responsibility for
// broadcasting that message no longer feels like it is a concern of polling, but rather a concern
// for whatever lower level function is doing something. E.g. putEntry or whatever in the database
// can broadcast a message when an entry is added, and that means polling does not need to do.
// In the interim, I should disable the poll broadcast channel

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

// TODO: pfc should be this bound

export async function pollFeeds(pfc) {
  assert(pfc instanceof PollFeedsContext);

  if(!pfc.ignoreIdleState && 'ONLY_POLL_IF_IDLE' in localStorage) {
    const state = await queryIdleState(pfc.idlePeriodSecs);
    if(state !== 'locked' && state !== 'idle') {
      console.debug('polling canceled because not idle');
      return;
    }
  }

  const feeds = await getFeedsFromDb(pfc.readerConn);

  // TODO: once pollFeed uses a this-bound pfc context, then this should be changed to just
  // call map and pass pfc as the thisArg to map (its rarely used 2nd argument).

  const promises = [];
  for(const feed of feeds) {
    promises.push(pollFeed(feed, pfc));
  }
  await promiseEvery(promises);

  const title = 'Added articles';
  const message = 'Added articles';
  showNotification(title, message);

  //const channel = new BroadcastChannel('poll');
  //channel.postMessage('completed');
  //channel.close();
}



// TODO: pfc should be this bound, not a parameter
async function pollFeed(feed, pfc) {
  assert(Feed.isFeed(feed));
  assert(pfc instanceof PollFeedsContext);

  // If the feed was polled too recently, then exit early.
  if(!pfc.ignoreRecencyCheck && feed.dateFetched) {
    const elapsedSinceLastPollMs = new Date() - feed.dateFetched;
    if(elapsedSinceLastPollMs > pfc.recencyPeriodMs) {
      return;
    }
  }

  // If offline, then exit early.
  // TODO: this check should be delegated to fetchFeed, which throws some type of error. The error
  // type should be distinct from other fetch errors (like 404) to indicate that the feed may still
  // exist, it is just not possible to fetch at the moment.
  if(!navigator.onLine) {
    console.debug('Cannot fetch feed with url while offline', url);
    return;
  }


  const url = Feed.peekURL(feed);

  const response = await fetchFeed(url, pfc.fetchFeedTimeoutMs, pfc.acceptHTML);

  if(!pfc.ignoreModifiedCheck && feed.dateUpdated && feed.dateLastModified &&
    response.lastModifiedDate && feed.dateLastModified.getTime() ===
    response.lastModifiedDate.getTime()) {
    console.debug('Skipping unmodified feed', url, feed.dateLastModified,
      response.lastModifiedDate);
    return;
  }

  const feedXML = await response.text();
  const PROCESS_ENTRIES = true;
  const parseResult = parseFeed(feedXML, url, response.responseURL, response.lastModifiedDate,
    PROCESS_ENTRIES);

  const mergedFeed = Feed.merge(feed, parseResult.feed);
  const storedFeed = await putFeed(mergedFeed, pfc.readerConn);
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

  await updateBadgeText(pfc.readerConn);
}
