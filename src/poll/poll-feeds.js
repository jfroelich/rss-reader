import {assert, AssertionError} from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as config from '/src/config.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import {composite_document_filter} from '/src/dom-filters.js';
import {set_base_uri} from '/src/dom-utils.js';
import * as favicon from '/src/favicon.js';
import * as net from '/src/net.js';
import * as note from '/src/note.js';
import {build as build_rewrite_rules} from '/src/poll/rewrite-rules.js';
import {rewrite_url} from '/src/poll/rewrite-url.js';
import * as sniff from '/src/poll/url-sniff.js';
import {parse_html} from '/src/utils.js';

// TODO: load defaults from config at start of poll instead of hardcoding
const default_options = {
  ignore_recency_check: false,
  recency_period: 5 * 60 * 1000,
  fetch_feed_timeout: new Deadline(5000),
  fetch_html_timeout: new Deadline(5000),
  fetch_image_timeout: new Deadline(3000),
  deactivation_threshold: 10,
  notify: true
};

function get_pollable_feeds(session) {
  return cdb.get_feeds(session, 'active', false);
}

export async function poll_feeds(session, iconn, options = {}) {
  options = Object.assign({}, default_options, options);

  const feeds = await get_pollable_feeds(session);
  const promises = [];
  for (const feed of feeds) {
    const promise = poll_feed(session, iconn, options, feed);
    const catch_promise = promise.catch(error => {
      // Fail on assertion, but skip over non-assertion with only warning
      if (error instanceof AssertionError) {
        throw error;
      } else {
        console.warn(error);
        // return undefined intentionally
      }
    });
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
    console.debug('Possibly showing poll-feeds notification');
    const notif = {};
    notif.title = 'Added articles';
    notif.message = 'Added articles';
    note.show(notif);
  }

  console.debug('poll-feeds completed. Added %d entries.', count);
}

// Check if a remote feed has new data and store it in the database
export async function poll_feed(session, iconn, options = {}, feed) {
  assert(cdb.is_feed(feed));
  assert(Array.isArray(feed.urls));
  assert(feed.urls.length > 0);
  assert(feed.active);

  // TEMP: enable for trace debugging
  console.debug('Polling', feed.urls[feed.urls.length - 1]);

  // TODO: this collection of rules should not be rebuilt per feed, so rules
  // should be a parameter to this function
  const rewrite_rules = build_rewrite_rules();

  const tail_url = new URL(feed.urls[feed.urls.length - 1]);

  // TODO: why is this check per feed and not per poll-feeds operation? I am
  // unsure whether that was a correct design decision. Investigate and review.
  if (!options.ignore_recency_check && options.recency_period &&
      feed.dateFetched) {
    const current_date = new Date();
    const time_since_last_fetch = current_date - feed.dateFetched;

    if (time_since_last_fetch < 0) {
      throw new Error('Invalid time since last fetch ' + time_since_last_fetch);
    }

    if (time_since_last_fetch < options.recency_period) {
      throw new Error(
          'Poll ran too recently ' + time_since_last_fetch + ' ' +
          options.recency_period);
    }
  }

  const fetch_options = {};
  fetch_options.timeout = options.fetch_feed_timeout;
  fetch_options.skip_entries = false;
  fetch_options.resolve_entry_urls = true;

  const skip_entries = false;
  const resolve_entry_urls = true;
  let response;
  try {
    response = await net.fetch_feed(tail_url, fetch_options);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    }

    await handle_fetch_error(
        session, error, feed, options.deactivation_threshold);
    return 0;
  }

  const merged_feed = merge_feed(feed, response.feed);
  handle_fetch_success(merged_feed);
  cdb.validate_feed(merged_feed);
  cdb.sanitize_feed(merged_feed);
  await cdb.update_feed(session, merged_feed, true);

  const count = await poll_entries(
      session, iconn, rewrite_rules, options, response.entries, merged_feed);

  if (options.notify && count) {
    const notif = {};
    notif.title = 'Added articles';
    notif.message =
        'Added ' + count + ' articles for feed ' + merged_feed.title;
    note.show(notif);
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
  if (error instanceof AssertionError) {
    // Never trap assertion failure at poll layer
    throw error;
  } else if (error instanceof EntryExistsError) {
    // ignore it, this is a routine exit condition
  } else {
    // Unknown error type, probably role is informative not logical
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
  const merged_feed = Object.assign(cdb.construct_feed(), old_feed, new_feed);
  merged_feed.urls = [...old_feed.urls];
  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      cdb.append_feed_url(merged_feed, new URL(url_string));
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
  // Avoid incrementing error count for programming error
  if (error instanceof AssertionError) {
    throw error;
  }

  // Ignore ephemeral errors that do not suggest the resource is unreachable
  // indefintely
  if (error instanceof net.TimeoutError || error instanceof net.OfflineError) {
    console.debug('Ignoring ephemeral fetch error', error);
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
  await cdb.update_feed(session, feed, true);
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
  const blank_entry = cdb.construct_entry();

  // Copy over everything
  const clone = Object.assign(blank_entry, parsed_entry);

  // Then convert the link property to a url in the urls property
  delete clone.link;
  if (parsed_entry.link) {
    try {
      cdb.append_entry_url(clone, new URL(parsed_entry.link));
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      } else {
        // ignore
      }
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
  assert(cdb.is_entry(entry));

  let url = new URL(entry.urls[entry.urls.length - 1]);
  cdb.append_entry_url(entry, rewrite_url(url, rewrite_rules));

  url = new URL(entry.urls[entry.urls.length - 1]);
  let existing_entry = await cdb.get_entry(session, 'url', url, true);
  if (existing_entry) {
    throw new EntryExistsError('Entry already exists for url ' + url.href);
  }

  // Fetch the entry full text. Reuse the url from above since it has not
  // changed. Trap fetch errors so that we can fall back to using feed content
  let response;
  if ((url.protocol === 'http:' || url.protocol === 'https:') &&
      sniff.classify(url) !== sniff.BINARY_CLASS && !url_is_inaccessible(url)) {
    try {
      response = await net.fetch_html(url, {timeout: fetch_html_timeout});
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      } else {
        console.debug(error);
      }
    }
  }

  // If we fetched and redirected, append the post-redirect response url, and
  // reapply url rewriting.
  let document;
  if (response) {
    let url_changed = false;
    const response_url = new URL(response.url);
    if (net.response_is_redirect(url, response)) {
      url_changed = true;
      cdb.append_entry_url(entry, response_url);
      cdb.append_entry_url(entry, rewrite_url(response_url, rewrite_rules));
      url = new URL(entry.urls[entry.urls.length - 1]);
      existing_entry = await cdb.get_entry(session, 'url', url, true);
      if (existing_entry) {
        throw new EntryExistsError(
            'Entry exists for redirected url ' + url.href);
      }
    }

    let response_text;
    try {
      response_text = await response.text();
      document = parse_html(response_text);
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      } else {
        console.debug(error);
      }
    }
  } else {
    try {
      document = parse_html(entry.content);
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      } else {
        console.debug(error);
        document = window.document.implementation.createHTMLDocument();
        document.documentElement.innerHTML =
            '<html><body>Malformed content (unsafe to display)</body></html>';
      }
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

  const filter_options = {};
  filter_options.contrast_matte = config.read_int('contrast_default_matte');
  filter_options.contrast_ratio = config.read_float('min_contrast_ratio');

  // Deserialize from config as a Deadline, not a raw int
  const config_set_image_sz_to = config.read_int('set_image_sizes_timeout');
  if (!isNaN(config_set_image_sz_to)) {
    filter_options.image_size_timeout = new Deadline(config_set_image_sz_to);
  }

  filter_options.table_scan_max_rows = config.read_int('table_scan_max_rows');

  // NOTE: may be NaN if not set or invalid value, only set if valid, this
  // was previously a bug
  const config_emph_max_len = config.read_int('emphasis_max_length');
  if (!isNaN(config_emph_max_len)) {
    filter_options.emphasis_max_length = config_emph_max_len;
  }

  filter_options.is_allowed_request = net.is_allowed_request;
  await composite_document_filter(document, filter_options);

  assert(
      document.documentElement,
      'document is missing document element? ' + document);

  entry.content = document.documentElement.outerHTML;
  cdb.sanitize_entry(entry);
  cdb.validate_entry(entry);
  return cdb.create_entry(session, entry);
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
  {pattern: /foxnews\.com$/i, reason: 'fake'},
  {pattern: /breitbart\.com$/i, reason: 'fake'},
  {pattern: /infowars\.com$/i, reason: 'fake'},
  {pattern: /drudgereport\.com$/i, reason: 'fake'},
  {pattern: /globalresearch\.ca$/i, reason: 'fake'},
  {pattern: /rt\.com$/i, reason: 'fake'},
  {pattern: /theblaze\.com$/i, reason: 'fake'},
  {pattern: /dailycaller\.com$/i, reason: 'fake'},
  {pattern: /dailywire\.com$/i, reason: 'fake'},
  {pattern: /ijr\.com$/i, reason: 'fake'},
  {pattern: /lifezette\.com$/i, reason: 'fake'},
  {pattern: /thegatewaypundit\.com$/i, reason: 'fake'},
  {pattern: /newsmax\.com$/i, reason: 'fake'},
  {pattern: /oann\.com$/i, reason: 'fake'},
  {pattern: /pjmedia\.com$/i, reason: 'fake'},
  {pattern: /rsbnetwork\.com$/i, reason: 'fake'},
  {pattern: /thefederalist\.com$/i, reason: 'fake'},
  {pattern: /therebel\.media$/i, reason: 'fake'},
  {pattern: /freebeacon\.com$/i, reason: 'fake'},
  {pattern: /twitchy\.com$/i, reason: 'fake'},
  {pattern: /michellemalkin\.com$/i, reason: 'fake'},
  {pattern: /truthrevolt\.org$/i, reason: 'fake'},
  {pattern: /wnd\.com$/i, reason: 'fake'},
  {pattern: /redstate\.com$/i, reason: 'fake'}
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
  const request = new favicon.LookupRequest();
  request.conn = iconn;
  request.url = lookup_url;
  request.document = document;
  const icon_url_string = await favicon.lookup(request);
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
