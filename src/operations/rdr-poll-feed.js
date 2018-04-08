import * as feed_parser from '/src/lib/feed-parser/feed-parser.js';
import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {coerce_entry, entry_has_url} from '/src/objects/entry.js';
import {coerce_feed, feed_has_url, feed_merge, feed_peek_url, feed_prepare, is_feed} from '/src/objects/feed.js';
import {rdr_badge_refresh} from '/src/operations/rdr-badge-refresh.js';
import {rdr_fetch_feed} from '/src/operations/rdr-fetch-feed.js';
import {rdr_notify} from '/src/operations/rdr-notify.js';
import {rdr_poll_entry} from '/src/operations/rdr-poll-entry.js';
import {update_feed} from '/src/operations/update-feed.js';


export async function rdr_poll_feed(
    rconn, iconn, channel, console, options = {}, feed) {
  const ignore_recency_check = options.ignore_recency_check;
  const ignore_modified_check = options.ignore_modified_check;
  const recency_period = options.recency_period;
  const badge_update = options.badge_update;
  const notify = options.notify;
  const deactivation_threshold = options.deactivation_threshold;
  const fetch_feed_timeout = options.fetch_feed_timeout;

  if (!is_feed(feed)) {
    throw new TypeError('feed is not a feed type ' + feed);
  }

  // Although this is borderline a programmer error, tolerate location-less
  // feed objects and simply ignore them
  if (!feed_has_url(feed)) {
    console.warn('Attempted to poll feed missing url', feed);
    return 0;
  }

  const tail_url = new URL(feed_peek_url(feed));

  // Although this is borderline a programmer error, tolerate attempting to
  // poll an inactive feed
  if (!feed.active) {
    console.debug('Ignoring inactive feed', tail_url.href);
    return 0;
  }

  console.log('Polling feed "%s"', feed.title, tail_url.href);

  // If the feed was polled too recently, exit
  if (!ignore_recency_check && feed.dateFetched) {
    const current_date = new Date();
    const elapsed_ms = current_date - feed.dateFetched;

    if (elapsed_ms < 0) {
      console.warn('Feed somehow polled in future?', tail_url.href);
      return 0;
    }

    if (elapsed_ms < recency_period) {
      console.debug('Feed polled too recently', tail_url.href);
      return 0;
    }
  }

  const response = await rdr_fetch_feed(tail_url, fetch_feed_timeout);
  if (!response.ok) {
    console.debug(
        'Error fetching feed', tail_url.href, response.status,
        response.statusText);
    const error_type = 'fetch';
    handle_error(
        rconn, channel, response.status, feed, error_type,
        deactivation_threshold);
    return 0;
  }

  const feed_lmd = feed.dateLastModified;
  const resp_lmd = new Date(response.headers.get('Last-Modified'));
  /*
    if (!ignore_modified_check && feed_lmd && resp_lmd &&
        !isNaN(resp_lmd.getTime()) && feed_lmd.getTime() === resp_lmd.getTime())
    { console.debug( 'Feed not modified', tail_url.href, feed_lmd.getTime(),
          resp_lmd.getTime());
      const dirtied = handle_fetch_success(feed);
      if (dirtied) {
        // TODO: actually this is not using any of the fetched data, so this
        // should not be revalidating? validate should be false here, right?

        // TODO: do I even care about considering this successful? Maybe this
        // case should just be a noop and no state modification should take
    place
        // and defer it until the feed actually changes?

        const validate = true;
        const set_date_updated = true;
        await update_feed(rconn, channel, feed, validate, set_date_updated);
      }
      return 0;
    }
  */

  // TODO: move this block into its own function, something like
  // try-parse-feed-helper, return undefined if should exit due to error
  // TODO: there should be a way to parse without an error occurring, because
  // parse errors are not programming errors just bad data, this requires
  // overhauling parse-feed though

  const response_text = await response.text();
  const skip_entries = false, resolve_urls = true;
  let parsed_feed;
  try {
    parsed_feed = feed_parser.parse(response_text, skip_entries, resolve_urls);
  } catch (error) {
    console.debug('Error parsing feed', tail_url.href, error);
    let status;
    const error_type = 'parse';
    handle_error(
        rconn, channel, status, feed, error_type, deactivation_threshold);
    return 0;
  }

  const response_url = new URL(response.url);

  const fetch_info = {
    request_url: tail_url,
    response_url: response_url,
    response_last_modified_date: resp_lmd
  };

  const coerced_feed = coerce_feed(parsed_feed, fetch_info);
  const merged_feed = feed_merge(feed, coerced_feed);
  handle_fetch_success(merged_feed);

  const storable_feed = feed_prepare(merged_feed);
  const validate = true;
  const set_date_updated = true;
  await update_feed(rconn, channel, storable_feed, validate, set_date_updated);

  const count = await poll_entries(
      rconn, iconn, channel, console, options, parsed_feed.entries,
      storable_feed);

  if (badge_update && count) {
    rdr_badge_refresh(rconn, console).catch(console.error);
  }

  if (notify && count) {
    const title = 'Added articles';
    const message =
        'Added ' + count + ' articles for feed ' + storable_feed.title;
    rdr_notify(title, message);
  }

  return count;
}

async function poll_entries(
    rconn, iconn, channel, console, options, entries, feed) {
  const feed_url_string = feed_peek_url(feed);

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

  const partial =
      rdr_poll_entry.bind(null, rconn, iconn, channel, console, options);
  const proms = entries.map(partial);
  const entry_ids = await Promise.all(proms);
  const count = entry_ids.reduce((sum, v) => v ? sum + 1 : sum, 0);
  return count;
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

function handle_error(
    rconn, channel, status, feed, type, deactivation_threshold) {
  // Ignore ephemeral errors
  if (status === url_loader.STATUS_TIMEOUT ||
      status === url_loader.STATUS_OFFLINE) {
    return;
  }

  // TEMPORARY DEBUGGING
  console.debug(
      'Incremented error count for feed', feed.title, feed.errorCount);

  // Init or increment
  feed.errorCount = Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;

  // Auto-deactivate on threshold breach
  if (feed.errorCount > deactivation_threshold) {
    feed.active = false;
    feed.deactivationReasonText = type;
    feed.deactivationDate = new Date();
  }

  // update unawaited
  // TODO: should be awaited though?
  const validate = true;
  const set_date_updated = true;
  const prom = update_feed(rconn, channel, feed, validate, set_date_updated);
  prom.catch(console.error);  // avoid swallowing
}

function dedup_entries(entries) {
  const distinct_entries = [];
  const seen_url_strings = [];

  for (const entry of entries) {
    if (!entry_has_url(entry)) {
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
