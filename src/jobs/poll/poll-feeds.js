import assert from "/src/assert.js";
import {showNotification} from "/src/extension.js";
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
  this.ignoreModifiedCheck = false;
  this.recencyPeriodMs = 5 * 60 * 1000;
  this.fetchFeedTimeoutMs = 5000;
  this.fetchHTMLTimeoutMs = 5000;
  this.fetchImageTimeoutMs = 3000;
  this.acceptHTML = true;
}

export async function pollFeeds() {
  assert(this instanceof PollFeedsContext);

  // Get all feeds from the database
  const feeds = await getFeedsFromDb(this.readerConn);
  // Concurrently poll each feed
  const promises = feeds.map(pollFeed, this);
  // Wait for all feed poll operations to complete
  await promiseEvery(promises);

  // TODO: this notification could be more informative, should report the number of articles added
  // like I did before. In order to do that, I need to modify pollFeed to return the number of
  // articles added for that feed, then collect the resolutions of the promises above, and then
  // derive the sum from the resolutions.
  const title = 'Added articles';
  const message = 'Added articles';
  showNotification(title, message);
}

async function pollFeed(feed) {
  assert(Feed.isFeed(feed));
  assert(this instanceof PollFeedsContext);

  console.log('Polling feed', Feed.peekURL(feed));

  // If the feed was polled too recently, then exit early.
  if(!this.ignoreRecencyCheck && feed.dateFetched instanceof Date) {
    const currentDate = new Date();
    const elapsedSinceLastPollMs = currentDate - feed.dateFetched;

    // If the amount of time since the feed was last fetched is less than the recency period,
    // then the feed was fetched too recently.

    if(elapsedSinceLastPollMs < this.recencyPeriodMs) {

      // TEMP: testing whether this is causing no feeds to update when ignoreRecencyCheck
      // is false.
      console.debug('Canceling feed poll, fetched too recently,', Feed.peekURL(feed),
        elapsedSinceLastPollMs, this.recencyPeriodMs);
      return;
    }
  }

  const url = Feed.peekURL(feed);

  const response = await fetchFeed(url, this.fetchFeedTimeoutMs, this.acceptHTML);

  if(!this.ignoreModifiedCheck && feed.dateUpdated && feed.dateLastModified &&
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
  const storedFeed = await putFeed(mergedFeed, this.readerConn);
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
  pec.readerConn = this.readerConn;
  pec.iconCache = this.iconCache;
  pec.feedFaviconURL = storedFeed.faviconURLString;
  pec.fetchHTMLTimeoutMs = this.fetchHTMLTimeoutMs;
  pec.fetchImageTimeoutMs = this.fetchImageTimeoutMs;
  const pollEntryPromises = entries.map(PollEntryModule.pollEntry, pec);
  await promiseEvery(pollEntryPromises);

  // TODO: the badge text call should not occur when no entries have been processed. This needs to
  // get information back from pollEntry, in the form of an array of resolutions, that ascertains
  // whether the number of entries added is not zero. Then only call updateBadgeText if the number
  // is not zero.

  await updateBadgeText(this.readerConn);
}
