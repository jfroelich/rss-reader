import assert from '/src/base/assert.js';
import * as html from '/src/base/html.js';
import * as favicon from '/src/base/iconsvc/favicon.js';
import * as ls from '/src/base/localstorage.js';
import {rewrite_url} from '/src/base/rewrite-url.js';
import {sanitize_document} from '/src/base/sandoc/sandoc.js';
import {set_base_uri} from '/src/base/set-base-uri.js';
import * as sniff from '/src/base/sniff.js';
import {fetch_feed} from '/src/control/fetch-feed.js';
import {fetch_html} from '/src/control/fetch-html.js';
import {is_allowed_request} from '/src/control/fetch-policy.js';
// TODO: import * as fetch_utils or something
import {OfflineError, response_is_redirect, TimeoutError} from '/src/control/fetch2.js';
import * as notification from '/src/control/notification.js';
import {build as build_rewrite_rules} from '/src/control/rewrite-rules.js';
import * as db from '/src/db/db.js';

// TODO: this module is huge, maybe my biggest, i don't like it, break it up
// somehow

const default_options = {
  ignore_recency_check: false,
  recency_period: 5 * 60 * 1000,
  fetch_feed_timeout: 5000,
  fetch_html_timeout: 5000,
  fetch_image_timeout: 3000,
  deactivation_threshold: 10,
  notify: true
};

function get_pollable_feeds(session) {
  return db.get_feeds(session, 'active', false);
}

export async function poll_feeds(session, iconn, options = {}) {
  options = Object.assign({}, default_options, options);

  const feeds = await get_pollable_feeds(session);
  const promises = [];
  for (const feed of feeds) {
    const promise = poll_feed(session, iconn, options, feed);
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
    notification.show(title, message);
  }

  console.debug('Added %d entries', count);
}

// Check if a remote feed has new data and store it in the database
export async function poll_feed(session, iconn, options = {}, feed) {
  assert(db.is_feed(feed));
  assert(Array.isArray(feed.urls));
  assert(feed.urls.length > 0);
  assert(feed.active);

  // TODO: this collection of rules should not be rebuilt per feed, so rules
  // should be a parameter to this function
  const rewrite_rules = build_rewrite_rules();

  const tail_url = new URL(feed.urls[feed.urls.length - 1]);

  if (!options.ignore_recency_check && feed.dateFetched) {
    const current_date = new Date();
    const time_since_last_fetch = current_date - feed.dateFetched;
    // TODO: it is wrong to use assert here, these assertions are not guarding
    // against programmer errors
    assert(time_since_last_fetch >= 0);
    assert(time_since_last_fetch >= options.recency_period);
  }

  const skip_entries = false;
  const resolve_entry_urls = true;
  let response;
  try {
    response = await fetch_feed(
        tail_url, options.fetch_feed_timeout, skip_entries, resolve_entry_urls);
  } catch (error) {
    await handle_fetch_error(
        session, error, feed, options.deactivation_threshold);
    return 0;
  }

  const merged_feed = merge_feed(feed, response.feed);
  handle_fetch_success(merged_feed);
  db.validate_feed(merged_feed);
  db.sanitize_feed(merged_feed);
  await db.update_feed(session, merged_feed, true);

  const count = await poll_entries(
      session, iconn, rewrite_rules, options, response.entries, merged_feed);

  if (options.notify && count) {
    const title = 'Added articles';
    const message =
        'Added ' + count + ' articles for feed ' + merged_feed.title;
    notification.show(title, message);
  }

  return count;
}

async function poll_entries(
    session, iconn, rewrite_rules, options, entries, feed) {
  const feed_url_string = feed.urls[feed.urls.length - 1];
  const coerced_entries = entries.map(coerce_entry);
  entries = dedup_entries(coerced_entries);
  propagate_feed_properties(feed, entries);

  const poll_entry_promises = [];
  for (const entry of entries) {
    const promise = poll_entry(
        session, iconn, entry, options.fetch_html_timeout,
        options.fetch_image_timeout, rewrite_rules, feed_url_string);
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

function propagate_feed_properties(feed, entries) {
  for (const entry of entries) {
    entry.feed = feed.id;
    entry.feedTitle = feed.title;
    entry.faviconURLString = feed.faviconURLString;

    if (feed.datePublished && !entry.datePublished) {
      entry.datePublished = feed.datePublished;
    }
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
  const merged_feed =
      Object.assign(db.create_feed_object(), old_feed, new_feed);
  merged_feed.urls = [...old_feed.urls];
  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      db.append_feed_url(merged_feed, new URL(url_string));
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

async function handle_fetch_error(session, error, feed, threshold) {
  if (error instanceof TimeoutError || error instanceof OfflineError) {
    return;
  }

  // Init or increment
  feed.errorCount = Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;

  console.debug(
      'Incremented error count for feed', feed.title, feed.errorCount);
  console.debug(error);

  // Auto-deactivate on threshold breach
  if (feed.errorCount > threshold) {
    console.debug('Deactivating feed', feed.urls[feed.urls.length - 1]);
    feed.active = false;
    feed.deactivationReasonText = 'fetch';
    feed.deactivationDate = new Date();
  }

  // No need to validate/sanitize, we've had control for the entire lifetime
  await db.update_feed(session, feed, true);
}

function dedup_entries(entries) {
  if (!entries) {
    console.warn('entries is not defined but should be');
    return [];
  }

  const distinct_entries = [];
  const seen_url_strings = [];

  for (const entry of entries) {
    if (!entry) {
      console.warn('undefined entry in entries list');
      continue;
    }

    if (!entry.urls || entry.urls.length < 1) {
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
  const blank_entry = db.create_entry_object();

  // Copy over everything
  const clone = Object.assign(blank_entry, parsed_entry);

  // Then convert the link property to a url in the urls property
  delete clone.link;
  if (parsed_entry.link) {
    try {
      db.append_entry_url(clone, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return clone;
}

// Processes an entry and possibly adds it to the database. Attempts to fetch
// the full text of the entry. Either returns the added entry id, or throws an
// error.
export async function poll_entry(
    session, iconn, entry, fetch_html_timeout, fetch_image_timeout,
    rewrite_rules, feed_url_string) {
  assert(db.is_entry(entry));

  let url = new URL(entry.urls[entry.urls.length - 1]);
  db.append_entry_url(entry, rewrite_url(url, rewrite_rules));

  url = new URL(entry.urls[entry.urls.length - 1]);
  let existing_entry = await db.get_entry(session, 'url', url, true);
  if (existing_entry) {
    throw new EntryExistsError('Entry already exists for url ' + url.href);
  }

  // Fetch the entry full text. Reuse the url from above since it has not
  // changed. Trap fetch errors so that we can fall back to using feed content
  let response;
  if ((url.protocol === 'http:' || url.protocol === 'https:') &&
      sniff.classify(url) !== sniff.BINARY_CLASS && !url_is_inaccessible(url)) {
    try {
      response = await fetch_html(url, fetch_html_timeout);
    } catch (error) {
      console.debug(error);
    }
  }

  // If we fetched and redirected, append the post-redirect response url, and
  // reapply url rewriting.
  let document;
  if (response) {
    let url_changed = false;
    const response_url = new URL(response.url);
    if (response_is_redirect(url, response)) {
      url_changed = true;
      db.append_entry_url(entry, response_url);
      db.append_entry_url(entry, rewrite_url(response_url, rewrite_rules));
      url = new URL(entry.urls[entry.urls.length - 1]);
      existing_entry = await db.get_entry(session, 'url', url, true);
      if (existing_entry) {
        throw new EntryExistsError(
            'Entry exists for redirected url ' + url.href);
      }
    }

    let response_text;
    try {
      response_text = await response.text();
      document = html.parse_html(response_text);
    } catch (error) {
      console.debug(error);
    }
  } else {
    try {
      document = html.parse_html(entry.content);
    } catch (error) {
      console.debug(error);
      document = window.document.implementation.createHTMLDocument();
      document.documentElement.innerHTML =
          '<html><body>Malformed content (unsafe to display)</body></html>';
    }
  }

  if (document && !entry.title) {
    const title_element = document.querySelector('html > head > title');
    if (title_element) {
      entry.title = title_element.textContent.trim();
    }
  }

  assert(document);

  await update_entry_icon(iconn, entry, document);

  set_base_uri(document, url);

  const sd_opts = {};
  sd_opts.contrast_matte = ls.read_int('contrast_default_matte');
  sd_opts.contrast_ratio = ls.read_float('min_contrast_ratio');
  sd_opts.image_size_timeout = ls.read_int('set_image_sizes_timeout');
  sd_opts.table_scan_max_rows = ls.read_int('table_scan_max_rows');
  sd_opts.emphasis_max_length = ls.read_int('emphasis_max_length');
  sd_opts.is_allowed_request = is_allowed_request;

  await sanitize_document(document, sd_opts);

  entry.content = document.documentElement.outerHTML;

  db.sanitize_entry(entry);
  db.validate_entry(entry);
  return db.create_entry(session, entry);
}

// TODO: somehow store in configuration instead of here, look into
// deserializing using Regex constructor or something
const inaccessible_content_descriptors = [
  {pattern: /forbes\.com$/i, reason: 'interstitial-advert'},
  {pattern: /productforums\.google\.com$/i, reason: 'script-generated'},
  {pattern: /groups\.google\.com$/i, reason: 'script-generated'},
  {pattern: /nytimes\.com$/i, reason: 'paywall'},
  {pattern: /wsj\.com$/i, reason: 'paywall'},
  {pattern: /heraldsun\.com\.au$/i, reason: 'requires-cookies'},
  {pattern: /ripe\.net$/i, reason: 'requires-cookies'},
  {pattern: /foxnews.com$/i, reason: 'fake'}
];

function url_is_inaccessible(url) {
  const descs = inaccessible_content_descriptors;
  for (const desc of descs) {
    if (desc.pattern && desc.pattern.test(url.hostname)) {
      return true;
    }
  }
  return false;
}

async function update_entry_icon(iconn, entry, document) {
  const lookup_url = new URL(entry.urls[entry.urls.length - 1]);
  const fetch = false;
  const icon_url_string =
      await favicon.lookup(iconn, lookup_url, document, fetch);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
}

function noop() {}

export class EntryExistsError extends Error {
  constructor(message = 'Entry already exists') {
    super(message);
  }
}
