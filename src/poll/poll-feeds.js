import * as app from '/src/app.js';
import {assert} from '/src/assert.js';
import {ReaderDAL} from '/src/dal.js';
import * as array from '/src/lang/array.js';
import * as Entry from '/src/model/entry.js';
import * as Feed from '/src/model/feed.js';
import {is_valid_feed, sanitize_feed} from '/src/model/sanity.js';
import {fetch_feed} from '/src/net/fetch-feed.js';
import {OfflineError, TimeoutError} from '/src/net/fetch2.js';
import {EntryExistsError, poll_entry} from '/src/poll/poll-entry.js';
import {build_rewrite_rules} from '/src/poll/rewrite-rules.js';

const chan_stub = {
  name: 'channel-stub',
  postMessage: noop,
  close: noop
};

const default_options = {
  ignore_recency_check: false,
  recency_period: 5 * 60 * 1000,
  fetch_feed_timeout: 5000,
  fetch_html_timeout: 5000,
  fetch_image_timeout: 3000,
  deactivation_threshold: 10,
  badge_update: true,
  notify: true
};

// Checks for new content
export async function poll_feeds(
    rconn, iconn, channel = chan_stub, options = {}) {
  const dal = new ReaderDAL();
  dal.conn = rconn;
  dal.channel = channel;

  const get_feeds_mode = 'active', get_feeds_sort = false;
  const feeds = await dal.getFeeds(get_feeds_mode, get_feeds_sort);

  options = Object.assign({}, default_options, options);

  // Concurrently poll feeds, skipping individual errors
  const promises = [];
  for (const feed of feeds) {
    const promise = poll_feed(rconn, iconn, channel, options, feed);
    const catch_promise = promise.catch(console.warn);
    promises.push(promise);
  }
  const results = await Promise.all(promises);

  let count = 0;
  for (const result of results) {
    if (result) {
      count += result;
    }
  }

  if (count) {
    const title = 'Added articles';
    const message = 'Added articles';
    app.show_notification(title, message);
  }

  console.debug('Added %d entries', count);
}


// Check if a remote feed has new data and store it in the database
export async function poll_feed(rconn, iconn, channel, options = {}, feed) {
  const ignore_recency_check = options.ignore_recency_check;
  const recency_period = options.recency_period;
  const badge_update = options.badge_update;
  const notify_flag = options.notify;
  const deactivation_threshold = options.deactivation_threshold;
  const fetch_feed_timeout = options.fetch_feed_timeout;

  assert(Feed.is_feed(feed));
  assert(!array.is_empty(feed.urls));
  assert(feed.active);

  const tail_url = new URL(array.peek(feed.urls));
  console.debug('Polling feed %s', tail_url.href);

  // Exit if the feed was checked too recently
  if (!ignore_recency_check && feed.dateFetched) {
    const current_date = new Date();
    const elapsed_ms = current_date - feed.dateFetched;
    assert(elapsed_ms >= 0);  // feed polled in future?
    assert(elapsed_ms >= recency_period);
  }

  // Fetch the feed. Trap non-programmer errors.
  const skip_entries = false;
  const resolve_entry_urls = true;
  let response;
  try {
    response = await fetch_feed(
        tail_url, fetch_feed_timeout, skip_entries, resolve_entry_urls);
  } catch (error) {
    // NOTE: in the error case, we only write the db-loaded feed back to the
    // database, and ignore any new info from the fetched feed.
    await handle_fetch_error(
        rconn, channel, error, feed, deactivation_threshold);
    return 0;
  }

  // Integrate the previous feed data with the new feed data
  const merged_feed = merge_feed(feed, response.feed);

  // Denote the fetch was successful. This is important to counteract error
  // counters that would lead to eventual deactivation
  handle_fetch_success(merged_feed);

  assert(is_valid_feed(merged_feed));
  sanitize_feed(merged_feed);

  const dal = new ReaderDAL();
  dal.conn = rconn;
  dal.channel = channel;
  await dal.updateFeed(merged_feed);

  const count = await poll_entries(
      rconn, iconn, channel, options, response.entries, merged_feed);

  if (notify_flag && count) {
    const title = 'Added articles';
    const message =
        'Added ' + count + ' articles for feed ' + merged_feed.title;
    app.show_notification(title, message);
  }

  return count;
}

async function poll_entries(rconn, iconn, channel, options, entries, feed) {
  const feed_url_string = array.peek(feed.urls);

  console.debug(
      'Processing %d entries for feed', entries.length, feed_url_string);

  const coerced_entries = entries.map(coerce_entry);
  entries = dedup_entries(coerced_entries);

  // Propagate feed properties to entries
  for (const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;

    if (feed.datePublished && !entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }

  const rewrite_rules = build_rewrite_rules();

  const poll_entry_promises = [];
  for (const entry of entries) {
    const promise = poll_entry(
        rconn, iconn, channel, entry, options.fetch_html_timeout,
        options.fetch_image_timeout, rewrite_rules);
    // Avoid Promise.all short-circuiting
    const catch_promise = promise.catch(poll_entry_onerror);
    poll_entry_promises.push(catch_promise);
  }
  const new_entry_ids = await Promise.all(poll_entry_promises);
  const count = new_entry_ids.reduce((sum, v) => v ? sum + 1 : sum, 0);
  return count;
}

function poll_entry_onerror(error) {
  if (error instanceof EntryExistsError) {
    // ignore it, this is a routine exit condition
  } else {
    // Use warn because errors are not critical and not handled, just logged
    // Note no difference here between programming error and typical errors
    // like fetch error, parse error
    console.warn(error);
  }
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference. Internally, after assignment, the merged
// feed has only the urls from the new feed. So the output feed's url array
// needs to be fixed. First copy over the old feed's urls, then try and append
// each new feed url.
function merge_feed(old_feed, new_feed) {
  const merged_feed = Object.assign(Feed.create(), old_feed, new_feed);
  merged_feed.urls = [...old_feed.urls];
  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      Feed.append_url(merged_feed, new URL(url_string));
    }
  }

  return merged_feed;
}

function handle_fetch_success(feed) {
  if ('errorCount' in feed) {
    if (typeof feed.errorCount === 'number') {
      if (feed.errorCount > 0) {
        feed.errorCount--;
        return true;
      }
    } else {
      delete feed.errorCount;
      return true;
    }
  }
  return false;
}

async function handle_fetch_error(
    rconn, channel, error, feed, deactivation_threshold) {
  // Ignore ephemeral fetch errors
  if (error instanceof TimeoutError || error instanceof OfflineError) {
    console.debug('Ignoring ephemeral fetch error', error);
    return;
  }

  console.debug(
      'Incremented error count for feed', feed.title, feed.errorCount);

  // Init or increment
  feed.errorCount = Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;

  // Auto-deactivate on threshold breach
  if (feed.errorCount > deactivation_threshold) {
    feed.active = false;
    feed.deactivationReasonText = 'fetch';
    feed.deactivationDate = new Date();
  }

  const dal = new ReaderDAL();
  dal.conn = rconn;
  dal.channel = channel;
  // No need to validate/sanitize, we've had control for the entire lifetime
  await dal.updateFeed(feed);
}

function dedup_entries(entries) {
  const distinct_entries = [];
  const seen_url_strings = [];

  for (const entry of entries) {
    if (array.is_empty(entry.urls)) {
      distinct_entries.push(entry);
      continue;
    }

    let url_is_seen = false;
    for (const url_string of entry.urls) {
      if (seen_url_strings.includes(url_string)) {
        url_is_seen = true;
        break;
      }
    }

    if (!url_is_seen) {
      distinct_entries.push(entry);
      seen_url_strings.push(...entry.urls);
    }
  }

  return distinct_entries;
}

// Reformat a parsed entry as a storable entry. The input object is cloned so as
// to avoid modification of input (purity).
// NOTE: I moved this out of entry.js because this has knowledge of both
// parse-format and storage-format. entry.js should be naive regarding parse
// format. This is a cross-cutting concern so it belongs in the place where the
// concerns meet.
function coerce_entry(parsed_entry) {
  const blank_entry = Entry.create_entry();

  // Copy over everything
  const clone = Object.assign(blank_entry, parsed_entry);

  // Then convert the link property to a url in the urls property
  delete clone.link;
  if (parsed_entry.link) {
    try {
      Entry.append_entry_url(clone, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return clone;
}


function noop() {}
