import assert from "/src/assert/assert.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import * as PollEntryModule from "/src/jobs/poll/poll-entry.js";
import {showNotification} from "/src/platform/platform.js";
import parseFeed from "/src/reader/parse-feed.js";
import putFeed from "/src/reader-db/put-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Feed from "/src/reader-db/feed.js";
import promiseEvery from "/src/utils/promise-every.js";

// Check for updated content for the given feed
export default async function pollFeed(feed) {
  assert(Feed.isFeed(feed));
  assert(this instanceof PollContext);

  console.log('Polling feed', Feed.peekURL(feed));

  if(didPollFeedRecently.call(this, feed)) {
    return;
  }

  const url = Feed.peekURL(feed);
  const response = await fetchFeed(url, this.fetchFeedTimeoutMs, this.acceptHTML);

  if(isUnmodifiedFeed.call(this, feed, response)) {
    return;
  }

  const feedXML = await response.text();
  const PROCESS_ENTRIES = true;
  const parseResult = parseFeed(feedXML, url, response.responseURL, response.lastModifiedDate,
    PROCESS_ENTRIES);

  const mergedFeed = Feed.merge(feed, parseResult.feed);
  const storedFeed = await putFeed(mergedFeed, this.readerConn);
  const entries = parseResult.entries;

  cascadeFeedPropertiesToEntries(storedFeed, entries);

  const numEntriesAdded = await pollEntries.call(this, storedFeed, entries);

  // TEMP: debugging new functionality
  assert(typeof numEntriesAdded === 'number' && numEntriesAdded >= 0);

  // If not in batch mode and some entries were added, update the badge.
  if(!this.batchMode && numEntriesAdded > 0) {
    await updateBadgeText(this.readerConn);
  }

  // If not in batch mode and some entries were added, then show a notification
  // TODO: use more specific title and message given that this is about a feed
  if(!this.batchMode && numEntriesAdded > 0) {
    const title = 'Added articles for feed';
    const message = 'Added articles for feed';
    showNotification(title, message);
  }
}

function didPollFeedRecently(feed) {
  assert(this instanceof PollContext);

  // Never consider a feed to have been polled recently if the recency check should be ignored
  if(this.ignoreRecencyCheck) {
    return false;
  }

  // If a feed has never been fetched, then it cannot have been polled recently.
  if(!(feed.dateFetched instanceof Date)) {
    return false;
  }

  // If the amount of time since the feed was last fetched is less than the recency period, then
  // the feed was fetched too recently.

  const currentDate = new Date();
  const elapsedSinceLastPollMs = currentDate - feed.dateFetched;

  // elapsed would be negative when dateFetched > currentDate, meaning that dateFetched is somehow
  // in the future. This should never happen.
  // TODO: not sure if this should be assert or check. Perhaps data integrity errors are to be
  // expected?
  assert(elapsedSinceLastPollMs >= 0);

  // NOTE: i could obviously make this section of code more concise by returning the result of
  // evaluating the condition, but I want the debugging message here for now. One reason is that
  // this was previously the source of a bug (the condition was backward). Two is because I want
  // to be informative when polling, I currently appreciate seeing when feeds are not polled for
  // some reason, and this is pretty much the only way this reason for not polling gets exposed.

  if(elapsedSinceLastPollMs < this.recencyPeriodMs) {
    console.debug('Feed fetched too recently', Feed.peekURL(feed),
      elapsedSinceLastPollMs, this.recencyPeriodMs);
    return true;
  }

  return false;
}

// Return true if the feed does not appear to have been modified from the last fetch, according
// to the last modified header of the response, and the cached last modified header of the last
// feed update.
function isUnmodifiedFeed(feed, response) {
  assert(this instanceof PollContext);

  // If the ignore modified check flag is set, then skip the check
  if(this.ignoreModifiedCheck) {
    return false;
  }

  // A feed that has never been updated should be updated, so pretend it is modified. This is
  // probably due to a feed that was added to the database but has never been polled.
  if(!feed.dateUpdated) {
    return false;
  }

  // If we do not know when the feed was last modified, then assume the feed has possibly been
  // modified.
  if(!feed.dateLastModified) {
    return false;
  }

  // If we could not get the file modification date from the response header, then we cannot tell
  // if the feed was modified, so assume it probably was modified.
  if(!response.lastModifiedDate) {
    return false;
  }

  // Otherwise, if the two dates match then the feed was not modified.
  if(feed.dateLastModified.getTime() === response.lastModifiedDate.getTime()) {
    console.debug('Feed not modified', Feed.peekURL(feed), feed.dateLastModified,
      response.lastModifiedDate);
    return true;
  }

  // Otherwise, the two dates do not match, and the feed was modified.
  return false;
}

function cascadeFeedPropertiesToEntries(feed, entries) {
  assert(feed.id);

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

async function pollEntries(feed, entries) {
  assert(this instanceof PollContext);

  const pec = new PollEntryModule.Context();
  pec.readerConn = this.readerConn;
  pec.iconCache = this.iconCache;
  pec.feedFaviconURL = feed.faviconURLString;
  pec.fetchHTMLTimeoutMs = this.fetchHTMLTimeoutMs;
  pec.fetchImageTimeoutMs = this.fetchImageTimeoutMs;

  // Concurrently process entries
  const pollEntryPromises = entries.map(PollEntryModule.pollEntry, pec);
  const pollEntryResolutions = await promiseEvery(pollEntryPromises);

  // pollEntry returns the entry that was added, otherwise it returns undefined if the entry was
  // not added. If it throws, then promiseEvery yields undefined in place of the rejection in
  // the resolutions array. Therefore, to get the number of entries added we simply iterate over
  // the resolutions array for defined things.

  let numEntriesAdded = 0;
  for(const resolution of pollEntryResolutions) {
    if(resolution) {
      numEntriesAdded++;
    }
  }

  return numEntriesAdded;
}
