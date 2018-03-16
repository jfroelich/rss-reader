import * as badge from '/src/badge.js';
import * as color from '/src/color/color.js';
import * as favicon_service from '/src/favicon-service/favicon-service.js';
import * as feed_parser from '/src/feed-parser/feed-parser.js';
import * as fetchlib from '/src/fetch/fetch.js';
import * as html_parser from '/src/html-parser/html-parser.js';
import notification_show from '/src/notifications/notifications.js';
import {dedup_entries} from '/src/poll-service/dedup-entries.js';
import {filter_entry_content} from '/src/poll-service/filter-entry-content.js';
import {coerce_entry} from '/src/rdb/coerce-entry.js';
import {coerce_feed} from '/src/rdb/coerce-feed.js';
import * as rdb from '/src/rdb/rdb.js';
import {rewrite_url} from '/src/rewrite-url/rewrite-url.js';
import {url_is_binary} from '/src/sniff/sniff.js';

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};

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
  console: null_console
};

const rewrite_url_rules = build_rewrite_rules();

function build_rewrite_rules() {
  const rules = [];

  function google_news_rule(url) {
    if (url.hostname === 'news.google.com' && url.pathname === '/news/url') {
      const param = url.searchParams.get('url');
      try {
        return new URL(param);
      } catch (error) {
      }
    }
  }

  rules.push(google_news_rule);

  function techcrunch_rule(url) {
    if (url.hostname === 'techcrunch.com' && url.searchParams.has('ncid')) {
      const output = new URL(url.href);
      output.searchParams.delete('ncid');
      return output;
    }
  }

  rules.push(techcrunch_rule);
  return rules;
}

function noop() {}

export async function poll_service_create_context() {
  const context = {};
  const promises = [rdb.open(), favicon_service.open()];
  [context.feedConn, context.iconConn] = await Promise.all(promises);
  context.channel = new BroadcastChannel('reader');
  return context;
}

export function poll_service_close_context(context) {
  if (context.channel) context.channel.close();
  if (context.feedConn) context.feedConn.close();
  if (context.iconConn) context.iconConn.close();
}

export async function poll_service_poll_feeds(input_poll_feeds_context) {
  const poll_feeds_context =
      Object.assign({}, default_poll_feeds_context, input_poll_feeds_context);
  poll_feeds_context.console.log('Polling feeds...');

  assert(poll_feeds_context.feedConn instanceof IDBDatabase);
  assert(poll_feeds_context.iconConn instanceof IDBDatabase);
  assert(poll_feeds_context.channel instanceof BroadcastChannel);

  const poll_feed_context = Object.assign({}, poll_feeds_context);
  poll_feed_context.badge_update = false;
  poll_feed_context.notify = false;

  // Concurrently poll the feeds
  const feeds = await rdb.find_active_feeds(poll_feeds_context.feedConn);
  const poll_feed_promises = [];
  for (const feed of feeds) {
    const promise = poll_service_feed_poll(poll_feed_context, feed);
    poll_feed_promises.push(promise);
  }

  const poll_feed_resolutions = await Promise.all(poll_feed_promises);
  let entry_add_count = 0;
  for (const entry_add_count_per_feed of poll_feed_resolutions) {
    if (!isNaN(entry_add_count_per_feed)) {
      entry_add_count += entry_add_count_per_feed;
    }
  }

  if (entry_add_count) {
    badge.update(poll_feeds_context.feedConn).catch(console.error);
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

  assert(poll_feed_context.feedConn instanceof IDBDatabase);
  assert(poll_feed_context.iconConn instanceof IDBDatabase);
  assert(poll_feed_context.channel instanceof BroadcastChannel);
  assert(rdb.is_feed(feed));
  assert(rdb.feed_has_url(feed));

  const console = poll_feed_context.console;
  const feed_tail_url = new URL(rdb.feed_peek_url(feed));
  console.log('Polling feed', feed_tail_url.href);

  if (!feed.active) {
    console.debug('Canceling poll feed as feed inactive', feed_tail_url.href);
    return 0;
  }

  if (polled_feed_recently(poll_feed_context, feed)) {
    console.debug(
        'Canceling poll feed as feed polled recently', feed_tail_url.href);
    return 0;
  }

  let response = await fetchlib.fetch_feed(
      feed_tail_url, poll_feed_context.fetchFeedTimeout);
  if (!response.ok) {
    // Now that fetch utility no longer throws and instead always returns
    // response, this needs to translate the response status into an error.
    // Eventually I should have handle_poll_feed_error just accept status code
    // instead
    let error;
    if (response.status === fetchlib.STATUS_TIMEOUT) {
      error = new fetchlib.TimeoutError(
          'Timeout error fetching ' + feed_tail_url.href);
    } else if (response.status === fetchlib.STATUS_OFFLINE) {
      error = new fetchlib.OfflineError(
          'Unable to fetch while offline ' + feed_tail_url.href);
    } else {
      error = new Error('Failed to fetch ' + feed_tail_url.href);
    }

    handle_poll_feed_error({
      context: poll_feed_context,
      error: error,
      feed: feed,
      category: 'fetch-feed'
    });
    return 0;
  }

  if (!detected_modification(
          poll_feed_context.ignoreModifiedCheck, feed, response)) {
    const state_changed = handle_fetch_feed_success(feed);
    if (state_changed) {
      feed.dateUpdated = new Date();
      await rdb.feed_put(
          poll_feed_context.feedConn, poll_feed_context.channel, feed);
    }
    return 0;
  }

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

  const skip_entries_flag = false;
  const resolve_entry_urls_flag = true;
  let parsed_feed;
  try {
    parsed_feed = feed_parser.parse(
        response_text, skip_entries_flag, resolve_entry_urls_flag);
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

  const response_url = new URL(response.url);
  const response_last_modified_date =
      fetchlib.response_get_last_modified_date(response);

  const fetch_info = {
    request_url: feed_tail_url,
    response_url: response_url,
    response_last_modified_date: response_last_modified_date
  };

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

  const merged_feed = rdb.feed_merge(feed, coerced_feed);
  handle_fetch_feed_success(merged_feed);

  const storable_feed = rdb.feed_prepare(merged_feed);
  storable_feed.dateUpdated = new Date();
  await rdb.feed_put(
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

  if (poll_entry_context.badge_update && entry_add_count_per_feed) {
    badge.update(poll_entry_context.feedConn).catch(console.error);
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
  // Call unawaited
  rdb.feed_put(error_info.context.feedConn, error_info.context.channel, feed)
      .catch(console.error);
}

function detected_modification(ignore_modified_check, feed, response) {
  if (ignore_modified_check) {
    return true;
  }

  if (!feed.dateLastModified) {
    return true;
  }

  const response_last_modified_date =
      fetchlib.response_get_last_modified_date(response);
  if (!response_last_modified_date) {
    return true;
  }

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

async function poll_entry(ctx, entry) {
  assert(typeof ctx === 'object');
  if (!rdb.entry_has_url(entry)) {
    return;
  }

  entry_rewrite_tail_url(entry);
  if (await entry_exists_in_db(ctx.feedConn, entry)) {
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

  let stored_entry;
  try {
    stored_entry = await rdb.entry_add(ctx.feedConn, ctx.channel, entry);
  } catch (error) {
    console.error(entry.urls, error);
    return;
  }

  return stored_entry.id;
}

function entry_rewrite_tail_url(entry) {
  const tail_url = new URL(rdb.entry_peek_url(entry));
  const new_url = rewrite_url(tail_url, rewrite_url_rules);
  if (!new_url) {
    return false;
  }
  return rdb.entry_append_url(entry, new_url);
}

function entry_exists_in_db(conn, entry) {
  const entry_tail_url = new URL(rdb.entry_peek_url(entry));
  return rdb.contains_entry_with_url(conn, entry_tail_url);
}

async function entry_fetch(entry, timeout) {
  const url = new URL(rdb.entry_peek_url(entry));
  if (!url_is_augmentable(url)) {
    return;
  }

  const response = await fetchlib.fetch_html(url, timeout);
  if (!response.ok) {
    console.debug('Failed to fetch url ' + url.href);
    return;  // return undefined response
  }
  return response;
}

async function entry_handle_redirect(conn, response, entry) {
  if (!response) {
    return false;
  }

  const entry_tail_url = new URL(rdb.entry_peek_url(entry));
  const entry_response_url = new URL(response.url);
  if (!fetchlib.url_did_change(entry_tail_url, entry_response_url)) {
    return false;
  }

  rdb.entry_append_url(entry, entry_response_url);
  entry_rewrite_tail_url(entry);
  return await entry_exists_in_db(conn, entry);
}

async function entry_parse_response(response) {
  if (!response) {
    return;
  }

  try {
    const response_text = await response.text();
    return html_parser.parse(response_text);
  } catch (error) {
    console.debug(error);
  }
}

function entry_update_title(entry, document) {
  assert(rdb.is_entry(entry));
  if (document && !entry.title) {
    const title_element = document.querySelector('html > head > title');
    if (title_element) {
      entry.title = title_element.textContent;
    }
  }
}

async function entry_update_favicon(ctx, entry, document) {
  assert(typeof ctx === 'object');
  assert(rdb.is_entry(entry));
  assert(rdb.entry_has_url(entry));
  const entry_tail_url = new URL(rdb.entry_peek_url(entry));
  const favicon_service_lookup_context = {
    conn: ctx.iconConn,
    skipURLFetch: true,
    url: entry_tail_url,
    document: document
  };

  try {
    const icon_url_string =
        await favicon_service.lookup(favicon_service_lookup_context);
    if (icon_url_string) {
      entry.faviconURLString = icon_url_string;
    }
  } catch (error) {
    console.debug(error);
  }
}

async function entry_update_content(ctx, entry, fetched_document) {
  let document = fetched_document;
  if (!document) {
    try {
      document = html_parser.parse(entry.content);
    } catch (error) {
      console.debug(error);
      entry.content =
          'There was a problem with this article\'s content (unsafe HTML).';
      return;
    }
  }

  const document_url = new URL(rdb.entry_peek_url(entry));
  const filter_options = {
    fetch_image_timeout: ctx.fetchImageTimeout,
    matte: color.WHITE,
    min_contrast_ratio: localStorage.MIN_CONTRAST_RATIO,
    emphasis_length_max: 200
  };
  await filter_entry_content(document, document_url, filter_options);
  entry.content = document.documentElement.outerHTML;
}

function url_is_augmentable(url) {
  return url_is_http(url) && !url_is_binary(url) &&
      !url_is_inaccessible_content(url);
}

function error_is_ephemeral(error) {
  return error instanceof fetchlib.OfflineError ||
      error instanceof fetchlib.TimeoutError;
}

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
