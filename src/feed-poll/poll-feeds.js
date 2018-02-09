import {coerce_entry} from '/src/coerce-entry.js';
import {coerce_feed} from '/src/coerce-feed.js';
import feed_parse from '/src/common/feed-parse.js';
import {fetch_feed, fetch_html, OfflineError, response_get_last_modified_date, TimeoutError, url_did_change} from '/src/common/fetch-utils.js';
import {html_parse} from '/src/common/html-utils.js';
import {lookup as favicon_service_lookup, open as favicon_service_open} from '/src/favicon-service.js';
import {dedup_entries} from '/src/feed-poll/dedup-entries.js';
import apply_all_document_filters from '/src/feed-poll/filters/apply-all.js';
import url_is_binary from '/src/feed-poll/is-binary-url.js';
import url_rewrite from '/src/feed-poll/rewrite-url.js';
import notification_show from '/src/notifications.js';
import {entry_append_url, entry_has_url, entry_peek_url, feed_has_url, feed_merge, feed_peek_url, rdb_contains_entry_with_url, rdb_entry_add, rdb_feed_prepare, rdb_feed_put, rdb_find_active_feeds, rdb_is_entry, rdb_is_feed, rdb_open} from '/src/rdb.js';
// TODO: this should not be dependent on something in the view, it should be the
// other way around
import badge_update_text from '/src/views/update-badge-text.js';

// TODO: rename to poll-service
// TODO: to enforce that the feed parameter is a feed object loaded from the
// database, it is possible that poll_service_feed_poll would be better
// implemented if it instead accepted a feedId as a parameter rather than an
// in-mem feed. That would guarantee the feed it works with is more trusted
// regarding the locally loaded issue.

const default_poll_feeds_context = {
  feedConn: null,
  iconConn: null,
  channel: null,
  ignoreRecencyCheck: false,
  ignoreModifiedCheck: false,
  recencyPeriod: 5 * 60 * 1000,
  fetchFeedTimeout: 5000,
  fetchHTMLTimeout: 5000,
  fetchImageTimeout: 3000,
  deactivationThreshold: 10,
  // By default, direct all messages to void
  console: {log: noop, warn: noop, debug: noop}
};

function noop() {}

// Create a new context object that is the typical context used by
// poll_service_poll_feeds
export async function poll_service_create_context() {
  const context = {};
  const promises = [rdb_open(), favicon_service_open()];
  [context.feedConn, context.iconConn] = await Promise.all(promises);

  // TODO: consider moving all lifetime management to caller
  // NOTE: this is the source of an object leak in slideshow context, where
  // this channel is created then replaced and left open. It has no listener,
  // but it is still heavyweight and and well, just incorrect.
  context.channel = new BroadcastChannel('reader');

  return context;
}

// Releases resources held in the context
// TODO: always closing channel is impedance mismatch with persistent channels
// used by calling contexts, rendering callers unable to easily call this
// function. Consider removing the close call here, or moving all channel
// lifetime management concerns to caller. This was the source of a bug in
// polling from slideshow, where polling closed the slideshow's persistent
// channel when it should not have
export function poll_service_close_context(context) {
  if (context.channel) context.channel.close();
  if (context.feedConn) context.feedConn.close();
  if (context.iconConn) context.iconConn.close();
}

export async function poll_service_poll_feeds(input_poll_feeds_context) {
  const poll_feeds_context =
      Object.assign({}, default_poll_feeds_context, input_poll_feeds_context);

  poll_feeds_context.console.log('Polling feeds...');

  // Sanity check some of the context state
  assert(poll_feeds_context.feedConn instanceof IDBDatabase);
  assert(poll_feeds_context.iconConn instanceof IDBDatabase);
  assert(poll_feeds_context.channel instanceof BroadcastChannel);

  // Setup a poll_feed_context to be shared among upcoming
  // poll_service_feed_poll calls
  const poll_feed_context = Object.assign({}, poll_feeds_context);
  // Flags specific to poll_service_feed_poll
  poll_feed_context.badge_update_text = false;
  poll_feed_context.notify = false;

  // Concurrently poll all the feeds
  const feeds = await rdb_find_active_feeds(poll_feeds_context.feedConn);
  const poll_feed_promises = [];
  for (const feed of feeds) {
    const promise = poll_service_feed_poll(poll_feed_context, feed);
    poll_feed_promises.push(promise);
  }

  // Wait for all outstanding promises to settle, then count up the total.
  // poll_service_feed_poll promises only throw in the case of programming/logic
  // errors
  const poll_feed_resolutions = await Promise.all(poll_feed_promises);
  let entry_add_count = 0;
  for (const entry_add_count_per_feed of poll_feed_resolutions) {
    if (!isNaN(entry_add_count_per_feed)) {
      entry_add_count += entry_add_count_per_feed;
    }
  }

  if (entry_add_count) {
    // Not awaited. We don't care if and when this ever completes, we just hope
    // that it does
    badge_update_text(poll_feeds_context.feedConn).catch(console.error);
  }

  if (entry_add_count) {
    const title = 'Added articles';
    const message = 'Added articles';
    notification_show(title, message);
  }

  poll_feeds_context.console.log('Added %d new entries', entry_add_count);
}

export async function poll_service_feed_poll(input_poll_feed_context, feed) {
  const poll_feed_context =
      Object.assign({}, default_poll_feeds_context, input_poll_feed_context);

  // Recheck sanity given this may not be called by poll_service_poll_feeds
  assert(poll_feed_context.feedConn instanceof IDBDatabase);
  assert(poll_feed_context.iconConn instanceof IDBDatabase);
  assert(poll_feed_context.channel instanceof BroadcastChannel);
  assert(rdb_is_feed(feed));
  assert(feed_has_url(feed));

  const console = poll_feed_context.console;
  const feed_tail_url = new URL(feed_peek_url(feed));
  console.log('Polling feed', feed_tail_url.href);

  // Avoid polling inactive feeds
  if (!feed.active) {
    console.debug('Canceling poll feed as feed inactive', feed_tail_url.href);
    return 0;
  }

  // Avoid polling recently polled feeds
  if (polled_feed_recently(poll_feed_context, feed)) {
    console.debug(
        'Canceling poll feed as feed polled recently', feed_tail_url.href);
    return 0;
  }

  // Fetch the feed. Trap the error to allow for
  // Promise.all(poll_service_feed_poll) to not short-circuit.
  let response;
  try {
    response =
        await fetch_feed(feed_tail_url, poll_feed_context.fetchFeedTimeout);
  } catch (error) {
    console.debug(error);

    handle_poll_feed_error({
      context: poll_feed_context,
      error: error,
      feed: feed,
      category: 'fetch-feed'
    });

    return 0;
  }

  // Cancel polling if no change in date modified
  if (!detected_modification(
          poll_feed_context.ignoreModifiedCheck, feed, response)) {
    const state_changed = handle_fetch_feed_success(feed);
    if (state_changed) {
      feed.dateUpdated = new Date();
      await rdb_feed_put(
          poll_feed_context.feedConn, poll_feed_context.channel, feed);
    }
    return 0;
  }

  // Get the body of the response
  let response_text;
  try {
    response_text = await response.text();
  } catch (error) {
    console.debug(error);
    handle_poll_feed_error({
      context: poll_feed_context,
      error: error,
      feed: feed,
      category: 'read-response-body'
    });
    return 0;
  }

  // Parse the response into a parsed feed object. Note that a parsed feed
  // object is not formatted the same as a storable feed object
  const skip_entries_flag = false;
  const resolve_entry_urls_flag = true;
  let parsed_feed;
  try {
    parsed_feed =
        feed_parse(response_text, skip_entries_flag, resolve_entry_urls_flag);
  } catch (error) {
    console.debug(error);
    handle_poll_feed_error({
      context: poll_feed_context,
      error: error,
      feed: feed,
      category: 'parse-feed'
    });
    return 0;
  }

  // Reformat the fetched feed as a storable feed
  const response_url = new URL(response.url);
  const response_last_modified_date = response_get_last_modified_date(response);

  const fetch_info = {
    request_url: feed_tail_url,
    response_url: response_url,
    response_last_modified_date: response_last_modified_date
  };

  // TODO: does coerce_feed throw anymore? I don't think it does actually
  // Revisit once coerce_feed_and_entries is fully deprecated
  let coerced_feed;
  try {
    coerced_feed = coerce_feed(parsed_feed, fetch_info);
  } catch (error) {
    console.debug(error);
    handle_poll_feed_error({
      context: poll_feed_context,
      error: error,
      feed: feed,
      category: 'coerce-feed'
    });
    return 0;
  }

  // Integrate the loaded feed with the fetched feed and store the
  // result in the database
  const merged_feed = feed_merge(feed, coerced_feed);

  // If we did not exit earlier as a result of some kind of error, then we want
  // to possibly decrement the error count and save the updated error count, so
  // that errors do not persist indefinitely.
  handle_fetch_feed_success(merged_feed);

  const storable_feed = rdb_feed_prepare(merged_feed);
  storable_feed.dateUpdated = new Date();
  await rdb_feed_put(
      poll_feed_context.feedConn, poll_feed_context.channel, storable_feed);

  // Process the entries
  const coerced_entries = parsed_feed.entries.map(coerce_entry);
  const entries = dedup_entries(coerced_entries);
  cascade_feed_properties_to_entries(storable_feed, entries);
  const poll_entry_promises = [];
  const poll_entry_context = Object.assign({}, poll_feed_context);
  for (const entry of entries) {
    const promise = poll_entry(poll_entry_context, entry);
    poll_entry_promises.push(promise);
  }

  const entry_ids = await Promise.all(poll_entry_promises);
  let entry_add_count_per_feed = 0;
  for (const entry_id of entry_ids) {
    if (entry_id) {
      entry_add_count_per_feed++;
    }
  }

  if (poll_entry_context.badge_update_text && entry_add_count_per_feed) {
    badge_update_text(poll_entry_context.feedConn).catch(console.error);
  }

  if (poll_entry_context.notify && entry_add_count_per_feed) {
    const title = 'Added articles';
    const message = 'Added ' + entry_add_count_per_feed +
        ' articles for feed ' + storable_feed.title;
    notification_show(title, message);
  }

  return entry_add_count_per_feed;
}

function polled_feed_recently(poll_feed_context, feed) {
  if (poll_feed_context.ignoreRecencyCheck) {
    return false;
  }

  if (!feed.dateFetched) {
    return false;
  }

  const current_date = new Date();
  const elapsed_millis = current_date - feed.dateFetched;
  assert(elapsed_millis >= 0, 'Polled feed in future??');

  return elapsed_millis < poll_feed_context.recencyPeriod;
}

// Decrement error count if set and not 0. Return true if object state changed.
function handle_fetch_feed_success(feed) {
  if ('errorCount' in feed) {
    if (typeof feed.errorCount === 'number') {
      if (feed.errorCount > 0) {
        feed.errorCount--;
        return true;
      } else {
        console.assert(feed.errorCount === 0);
      }
    } else {
      delete feed.errorCount;
      return true;
    }
  }
  return false;
}

// TODO: new kind of problem, in hindsight, is merging of count of errors for
// parsing and fetching. suppose a feed file which is periodically updated
// becomes not-well-formed, causing parsing error. This is going to on the poll
// period update the error count. This means that after a couple polls, the
// feed quickly becomes inactive. That would be desired for the fetch error
// count, maybe, but not for the parse error count. Because eventually the feed
// file will get updated again and probably become well formed again. I've
// actually witnessed this. So the issue is this prematurely deactivates feeds
// that happen to have a parsing error that is actually ephemeral (temporary)
// and not permanent.


// TODO: rather than try and update the database, perhaps it would be better to
// simply generate an event with feed id and some basic error information, and
// let some error handler handle the event at a later time. This removes all
// concern over encountering a closed database or closed channel at the time of
// the call to rdb_feed_put, and maintains the non-blocking
// characteristic.
function handle_poll_feed_error(error_info) {
  if (error_is_ephemeral(error_info.error)) {
    return;
  }

  const feed = error_info.feed;
  feed.errorCount = Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;
  if (feed.errorCount > error_info.context.deactivationThreshold) {
    feed.active = false;
    feed.deactivationReasonText = error_info.category;
    feed.deactivationDate = new Date();
  }

  feed.dateUpdated = new Date();
  // Call unawaited (non-blocking)
  rdb_feed_put(error_info.context.feedConn, error_info.context.channel, feed)
      .catch(console.error);
}

function detected_modification(ignore_modified_check, feed, response) {
  // If this flag is true, then pretend the feed is always modified
  if (ignore_modified_check) {
    return true;
  }

  // TODO: rename dateLastModified to lastModifiedDate to be more consistent
  // in field names. I just got bit by this inconsistency.

  // Pretend feed modified if no known modified date
  // NOTE: this returns true to indicate the feed SHOULD be considered modified,
  // because without the last modified date, we can't use the dates to
  // determine, so we presume modified. We can only more confidently assert not
  // modified, but not unmodified.
  if (!feed.dateLastModified) {
    console.debug('Unknown last modified date for feed', feed_peek_url(feed));
    return true;
  }

  const response_last_modified_date = response_get_last_modified_date(response);

  // If response is undated, then return true to indicate maybe modified
  if (!response_last_modified_date) {
    // TODO: if it is the normal case this shouldn't log. I am tentative for
    // now, so logging
    console.debug('Response missing last modified date?', response);
    return true;
  }

  // Return true if the dates are different
  // Return false if the dates are the same
  return feed.dateLastModified.getTime() !==
      response_last_modified_date.getTime();
}

function cascade_feed_properties_to_entries(feed, entries) {
  for (const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;

    if (feed.datePublished && !entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
  }
}

// Returns the entry id if added.
async function poll_entry(ctx, entry) {
  assert(typeof ctx === 'object');
  // The sanity check for the entry argument is implicit in the call to
  // entry_has_url

  // This function cannot assume the input entry has a url, but a url is
  // required to continue polling the entry
  if (!entry_has_url(entry)) {
    return;
  }

  entry_url_rewrite(entry);

  if (await entry_reader_db_exists(ctx.feedConn, entry)) {
    return;
  }

  const response = await entry_fetch(entry, ctx.fetchHTMLTimeout);
  const redirected_entry_exists =
      await entry_handle_redirect(ctx.feedConn, response, entry);
  if (redirected_entry_exists) {
    return;
  }

  const document = await entry_parse_response(response);
  entry_update_title(entry, document);
  await entry_update_favicon(ctx, entry, document);
  await entry_update_content(ctx, entry, document);

  // Despite checks for whether the url exists, we can still get uniqueness
  // constraint errors when putting an entry in the store (from url index of
  // entry store). This should not be fatal to polling, so trap and log the
  // error and return.

  // TODO: I think I need to look into this more. This may be a consequence of
  // not using a single shared transaction. Because I am pretty sure that if I
  // am doing rdb_contains_entry_with_url lookups, that I shouldn't run
  // into this error here? It could be the new way I am doing url rewriting.
  // Perhaps I need to do contains checks on the intermediate urls of an entry's
  // url list as well. Which would lead to more contains lookups, so maybe also
  // look into batching those somehow.

  let stored_entry;
  try {
    stored_entry = await rdb_entry_add(ctx.feedConn, ctx.channel, entry);
  } catch (error) {
    console.error(entry.urls, error);
    return;
  }

  return stored_entry.id;
}

// Examines the current tail url of the entry. Attempts to rewrite it and
// append a new tail url if the url was rewritten and was distinct from other
// urls. Returns true if a new url was appended.
function entry_url_rewrite(entry) {
  // sanity assertions about the entry argument are implicit within
  // entry_peek_url
  const entry_tail_url = new URL(entry_peek_url(entry));
  const entry_response_url = url_rewrite(entry_tail_url);
  // url_rewrite returns undefined in case of error, or when no rewriting
  // occurred.
  // TODO: consider changing url_rewrite so that it always returns a url, which
  // is simply the same url as the input url if no rewriting occurred.

  if (!entry_response_url) {
    return false;
  }

  // entry_append_url only appends the url if the url does not already exist in
  // the entry's url list. entry_append_url returns true if an append took
  // place.
  return entry_append_url(entry_response_url);
}

function entry_reader_db_exists(conn, entry) {
  // NOTE: this only inspects the tail, not all urls. It is possible due to
  // some poorly implemented logic that one of the other urls in the entry's
  // url list exists in the db At the moment I am more included to allow the
  // indexedDB put request that happens later to fail due to a constraint
  // error. This function is more of an attempt at reducing processing than
  // maintaining data integrity.

  const entry_tail_url = new URL(entry_peek_url(entry));
  return rdb_contains_entry_with_url(conn, entry_tail_url);
}

// Tries to fetch the response for the entry. Returns undefined if the url is
// not fetchable by polling policy, or if the fetch fails.
async function entry_fetch(entry, timeout) {
  const url = new URL(entry_peek_url(entry));
  if (!url_is_augmentable(url)) {
    return;
  }

  try {
    return await fetch_html(url, timeout);
  } catch (error) {
    console.debug(error);
  }
}



// Checks if the entry redirected, and if so, possibly updates the entry and
// returns whether the redirect url already exists in the database
async function entry_handle_redirect(conn, response, entry) {
  // response may be undefined due to fetch error, this is not an error or
  // unexpected
  if (!response) {
    return false;
  }

  const entry_tail_url = new URL(entry_peek_url(entry));
  const entry_response_url = new URL(response.url);
  if (!url_did_change(entry_tail_url, entry_response_url)) {
    return false;
  }

  entry_append_url(entry, entry_response_url);

  // It is important to rewrite before exists check to be consistent with the
  // pattern used before fetching for the original url. This way we don't need
  // to lookup the unwritten url, because all urls are always rewritten before
  // interacting with reader db

  entry_url_rewrite(entry);
  return await entry_reader_db_exists(conn, entry);
}

async function entry_parse_response(response) {
  // There is no guarantee response is defined, this is not unexpected and not
  // an error
  if (!response) {
    return;
  }

  try {
    const response_text = await response.text();
    return html_parse(response_text);
  } catch (error) {
    console.debug(error);
  }
}

// If an entry is untitled in the feed, and we were able to fetch the full
// text of the entry, try and set the entry's title using data from the full
// text.
function entry_update_title(entry, document) {
  assert(rdb_is_entry(entry));
  // This does not expect document to always be defined. The caller may have
  // failed to get the document. Rather than require the caller to check, do
  // the check here.
  if (!document) {
    return;
  }

  // This only applies to an untitled entry.
  if (entry.title) {
    return;
  }

  const title_element = document.querySelector('html > head > title');
  if (title_element) {
    entry.title = title_element.textContent;
  }
}

// Attempts to set the favicon url property of the entry
// @param ctx {Object} misc props, should contain iconConn, an active
// connection to the favicon store. Technically the lookup can operate without
// an active connection so it is ok if it is undefined
// @param entry {Object} an object representing a entry in the app's storage
// format
// @param document {Document} optional, the pre-fetched document for the entry.
// If specified, the favicon lookup will reuse it instead of attempting to
// fetch the document again.
async function entry_update_favicon(ctx, entry, document) {
  assert(typeof ctx === 'object');
  assert(rdb_is_entry(entry));

  // Something is really wrong if this fails
  assert(entry_has_url(entry));

  const entry_tail_url = new URL(entry_peek_url(entry));

  // Create the lookup context. Signal to the lookup it should not try and
  // fetch the document for the url, because we know we've already tried that.
  // Lookup cannot otherwise tell because document may be undefined here.

  const favicon_service_lookup_context = {
    conn: ctx.iconConn,
    skipURLFetch: true,
    url: entry_tail_url,
    document: document
  };

  // Favicon lookup failure is not fatal to polling an entry. Rather than
  // require the caller to handle the error, handle the error locally.

  // TODO: if favicon only fails in event of a critical error, such as a
  // programming error or database error, then it actually should be fatal, and
  // this shouldn't use try/catch. However, I've forgotten all the specific
  // cases of when the lookup throws. If it throws in case of failed fetch for
  // example that is not a critical error. For now I am leaving in the
  // try/catch.

  try {
    const icon_url_string =
        await favicon_service_lookup(favicon_service_lookup_context);

    // Only set favicon if found. This way the previous value is retained.
    // Earlier code may set it, for example, to default to the feed's own
    // favicon.
    if (icon_url_string) {
      entry.faviconURLString = icon_url_string;
    }
  } catch (error) {
    console.debug(error);
  }
}

async function entry_update_content(ctx, entry, fetched_document) {
  // There is no expectation that document is defined. When undefined, we want
  // to use the entry original summary content from the feed. In both cases the
  // content must be filtered

  let document = fetched_document;
  if (!document) {
    try {
      document = html_parse(entry.content);
    } catch (error) {
      console.debug(error);
      // We do not have a fetched doc, and we also failed to parse the entry's
      // content from the feed. Redact the content for safety.
      entry.content =
          'There was a problem with this article\'s content (unsafe HTML).';
      return;
    }
  }

  const document_url = new URL(entry_peek_url(entry));
  await apply_all_document_filters(
      document, document_url, ctx.fetchImageTimeout);
  entry.content = document.documentElement.outerHTML;
}

function url_is_augmentable(url) {
  return url_is_http(url) && !url_is_binary(url) &&
      !url_is_inaccessible_content(url);
}

// Return true if the error represents a temporary error
function error_is_ephemeral(error) {
  return error instanceof OfflineError || error instanceof TimeoutError;
}

// An array of descriptors. Each descriptor represents a test against a url
// hostname, that if matched, indicates the content is not accessible.
const INACCESSIBLE_CONTENT_DESCRIPTORS = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'}
];

function url_is_inaccessible_content(url) {
  for (const desc of INACCESSIBLE_CONTENT_DESCRIPTORS) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

function url_is_http(url) {
  return url.protocol === 'http:' || url.protocol === 'https:';
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
