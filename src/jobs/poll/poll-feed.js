import assert from "/src/assert/assert.js";
import {showNotification} from "/src/extension.js";

import fetchFeed from "/src/fetch/fetch-feed.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import * as PollEntryModule from "/src/jobs/poll/poll-entry.js";
import parseFeed from "/src/reader/parse-feed.js";
import putFeed from "/src/reader-db/put-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Feed from "/src/reader-db/feed.js";
import promiseEvery from "/src/utils/promise-every.js";

export default async function pollFeed(feed) {
  assert(Feed.isFeed(feed));
  assert(this instanceof PollContext);

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
  if(!this.batchMode) {
    await updateBadgeText(this.readerConn);
  }

  // If not in batch mode then send a notification
  // TODO: use more specific title and message given that this is about a feed
  // TODO: do not show a notification if no entries added, but to do this I need to get the
  // number of entries added, so that will have to wait until pollEntry returns that.
  if(!this.batchMode) {
    const title = 'Added articles for feed';
    const message = 'Added articles for feed';
    showNotification(title, message);
  }

}
