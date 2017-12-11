import assert from "/src/assert/assert.js";
import {OfflineError} from "/src/fetch/errors.js";
import fetchFeed from "/src/fetch/fetch-feed.js";
import PollContext from "/src/jobs/poll/poll-context.js";
import * as PollEntryModule from "/src/jobs/poll/poll-entry.js";
import {showNotification} from "/src/platform/platform.js";
import parseFeed from "/src/reader/parse-feed.js";
import putFeedInDb from "/src/reader-db/put-feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Feed from "/src/reader-db/feed.js";
import promiseEvery from "/src/promise/every.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";

// TODO: to enforce that the feed parameter is a feed object loaded from the database, it is
// possible that pollFeed would be better implemented if it instead accepted a feedId as a
// parameter, and loaded the feed here. That would guarantee the feed it works with is more trusted
// regarding the locally loaded issue.

// TODO: this grew kind of complex, eventually need to rethink and simplify
// TODO: pollFeeds is a job, but pollFeed no longer is a job, it is now a shared module that is
// also used by subscribe to get a feed's entries. So maybe poll-feed should be its own module


// After 10 various kinds of errors, deactivate.
const FEED_ERROR_COUNT_DEACTIVATION_THRESHOLD = 10;


// Check for updated content for the given feed
export default async function pollFeed(feed) {
  assert(this instanceof PollContext);
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const url = Feed.peekURL(feed);
  console.log('Polling feed', url);

  if(didPollFeedRecently.call(this, feed)) {
    // Return 0 to indicate no entries added
    return 0;
  }

  // Fetch the feed
  const requestURL = new URL(url);
  let response;
  try {
    response = await fetchFeed(requestURL, this.fetchFeedTimeoutMs, this.extendedFeedTypes);
  } catch(error) {
    await handlePollFeedError(error, this.readerConn, feed, 'fetch-feed');
  }

  assert(typeof response !== 'undefined');

  // TODO: in the process of implementing I realized I also want to treat parse errors as errors
  // contributing toward the deactivation threshold, not just fetch errors. The question is whether
  // I want to track the two error counts separately or using the same error counter. If using the
  // same error counter then I need to rename everything here to use more generic errorCounter name
  // instead of fetch prefix. Before I do that I basically need to reach a decision regarding
  // the difference between fetch error and parse error.

  // Update feed properties appropriately when the feed is successfully fetched, and capture whether
  // any properties changed.
  const errorCountChanged = handleFetchFeedSuccess(feed);

  if(isUnmodifiedFeed.call(this, feed, response)) {

    // Even if the feed file has not changed since it was last fetched, we still possibly need to
    // update the feed in the database to reflect that the last fetch was successful, to prevent
    // fetch error counts from sticking around forever.
    if(errorCountChanged) {
      console.debug('Feed unmodified, error count changed, storing and exiting early');
      const skipPrep = true;
      await putFeedInDb(feed, this.readerConn, skipPrep);
    }

    // Because the feed has not changed, there is no need to do any additional processing.
    // Return 0 to indicate no entries added
    return 0;
  }

  // Get the body of the response. Any issues with reading the body should be treated like fetch
  // errors and handled similarly.
  let feedXML;
  try {
    feedXML = await response.text();
  } catch(error) {
    await handlePollFeedError(error, this.readerConn, feed, 'read-response-body');
  }

  // Either (1) the above call threw as expected and this is never reached or (2) feedXML was
  // assigned a string value.
  assert(typeof feedXML === 'string');

  let parseResult;
  const PROCESS_ENTRIES = true;
  try {
    parseResult = parseFeed(feedXML, url, response.responseURL, response.lastModifiedDate,
      PROCESS_ENTRIES);
  } catch(error) {
    await handlePollFeedError(error, this.readerConn, feed, 'parse-feed');
  }

  const mergedFeed = Feed.merge(feed, parseResult.feed);
  const skipPrep = false;
  const storedFeed = await putFeedInDb(mergedFeed, this.readerConn, skipPrep);

  // Now process the entries
  const entries = parseResult.entries;
  cascadeFeedPropertiesToEntries(storedFeed, entries);

  const numEntriesAdded = await pollEntries.call(this, storedFeed, entries);

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

  return numEntriesAdded;
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
  // some reason, and this is pretty much the only way this reason is exposed due to naive design.

  if(elapsedSinceLastPollMs < this.recencyPeriodMs) {
    console.debug('Feed fetched too recently', Feed.peekURL(feed),
      elapsedSinceLastPollMs, this.recencyPeriodMs);
    return true;
  }

  return false;
}

// When a feed is successfully fetched, we want to indicate that prior fetch errors, if any exist,
// were probably ephemeral (temporary) errors that do not indicate a serious problem with the feed.
// The fetch error count is tracked. If successful then this tries to decrement the count back to
// 0. Returns true if the error count property changed. Note that the error count can be modified
// externally, by other functions, for other reasons, this does not have exclusive control over the
// count, and the count does not only pertain to fetch errors.
//
// Note that this never reactivates an inactive feed. Whether a feed is active or inactive is not
// taken into consideration. This is because it is some other part of the app's concern for
// reactivating a feed. In fact almost nothing does automatic activation. Once a feed becomes
// inactive, it is left inactive until the user manually activates it.
function handleFetchFeedSuccess(feed) {
  if('errorCount' in feed) {
    if(typeof feed.errorCount === 'number') {
      if(feed.errorCount > 0) {
        // Decrement by 1 if greater than 0.
        feed.errorCount--;
        console.debug('Decremented error count to %d on successful fetch', feed.errorCount);
        return true;
      } else {
        // Leave at 0.

        // Weakly check that it is 0 (should never be negative)
        console.assert(feed.errorCount === 0);

        // TEMP: tracing new functionality
        console.debug('Leaving error count at 0 on successful fetch');
      }
    } else {
      console.debug('Removing invalid error count property on successful fetch');
      // The feed has a errorCount property that is defined as a feed property but does not
      // have a valid value.
      delete feed.errorCount;
      return true;
    }
  } else {
    // nothing to do
    console.debug('Leaving error count unset on successful fetch');
  }

  return false;
}

// Does some possibly extra error handling in the event that fetching the feed failed, or getting
// the body content of the http response failed, or parsing the body failed. This
// ALWAYS throws an error (if not then there is a programming error somewhere).
// @param error {Error}
// @param conn {IDBDatabase}
// @param feed {Object}
// @param callCategory {String} optional, a machine-readable string description of the context in
// which the call was made
async function handlePollFeedError(error, conn, feed, callCategory) {
  // Unchecked errors indicate programming errors. This happens regardless of the category.
  if(isUncheckedError(error)) {
    throw error;
  }

  // If this handler was called in catch block of fetch, then need to consider special case of
  // offline errors. Offline errors are not indicative of a feed becoming permanently unreachable
  // or that a fetch failed because it is unreachable.
  if(callCategory === 'fetch-feed' && error instanceof OfflineError) {
    throw error;
  }

  // Some kind of network or fetch error occurred, such as the feed being unreachable. Or there
  // was a problem reading the response body, or a problem parsing. Before throwing the error,
  // record that the error occurred. If enough errors accumulate then this should deactivate the
  // feed.

  const priorErrorCount = feed.errorCount; // may be undef
  if(Number.isInteger(feed.errorCount)) {
    feed.errorCount++;
  } else {
    feed.errorCount = 1;
  }

  console.debug('Changing error count for feed %s from %d to %d', Feed.peekURL(feed),
    priorErrorCount, feed.errorCount);

  if(feed.errorCount > FEED_ERROR_COUNT_DEACTIVATION_THRESHOLD) {
    console.debug('Error count exceeded threshold, deactivating feed', feed.id, Feed.peekURL(feed));

    feed.active = false;

    // Despite the mixture of errors, whatever error was the last error that caused the threshold
    // to be exceeded is what indicates the reason for deactivation.
    if(typeof callCategory !== 'undefined') {
      feed.deactivationReasonText = callCategory;
    }
    feed.deactivationDate = new Date();
  }

  // In this context we are dealing with a feed loaded from the database, and are not changing
  // any user properties, only system properties.
  const skipPrep = true;

  // TODO: maybe this should be independent (concurrent)? Right now this benefits from using the
  // same shared connection. It isn't too bad in the sense that the success path also has a
  // blocking call when storing the feed. However, it feels like it shouldn't need to block. But
  // non-blocking seems a bit complex at the moment, so just getting it working for now.
  // NOTE: this can also throw, and thereby mask the error, but I suppose that is ok, because
  // both are errors, and in this case I suppose the db error trumps the fetch error
  await putFeedInDb(feed, conn, skipPrep);

  // We've partially handled the error in the sense that we attached side effects to it, but we
  // do not affect how the error affects the code evaluation path. That is up to caller. So this
  // throws the error and leaves it up to the caller.
  throw error;
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
  pec.channel = this.channel;

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
