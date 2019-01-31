import {assert, AssertionError} from '/src/assert.js';
import * as cdb from '/src/cdb.js';
import * as config from '/src/config.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as dom_filters from '/src/dom-filters.js';
import * as dom_utils from '/src/dom-utils.js';
import * as favicon from '/src/favicon.js';
import * as net from '/src/net.js';
import * as note from '/src/note.js';
import {build as build_rewrite_rules} from '/src/poll/rewrite-rules.js';
import {rewrite_url} from '/src/poll/rewrite-url.js';
import * as sniff from '/src/poll/url-sniff.js';
import * as utils from '/src/utils.js';

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

export async function poll_feeds(session, iconn, input_options = {}) {
  // Clone options into a local object so that modifications do not produce
  // side effects on parameters and avoid caller surprise
  const options = Object.assign({}, default_options, input_options);

  // Load feeds that are pollable from the database in natural order
  const feeds = await cdb.get_feeds(session, 'active', false);
  console.debug('Loaded %d feeds for polling', feeds.length);

  // Concurrently poll each feed
  const promises = feeds.map(feed => {
    return poll_feed(session, iconn, options, feed);
  });

  // Wait for all poll-feed promises to settle
  const results = await Promise.all(promises);

  // TEMP: researching poll issue
  console.debug('All feeds polled');

  // Calculate the total number of entries added across all feeds.
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

  if (!cdb.feed_has_url(feed)) {
    console.warn('Tried to poll feed without url', feed);
    return 0;
  }

  if (!feed.active) {
    console.warn('Tried to poll feed that is inactive', feed);
    return 0;
  }

  // TEMP: enable for trace debugging issue with poll hang
  console.debug('Polling feed', cdb.feed_get_url(feed));

  const rewrite_rules = build_rewrite_rules();
  const tail_url = new URL(cdb.feed_get_url(feed));

  // TEMP: disabled recency limit during debugging.This is not the best way to
  // debug but trying to do this quickly and with no effort. Remove the
  // false && here to reenable.

  if (false && !options.ignore_recency_check && options.recency_period &&
      feed.dateFetched) {
    const current_date = new Date();
    const time_since_last_fetch = current_date - feed.dateFetched;

    if (time_since_last_fetch < 0) {
      console.debug('Poll ran too recently, elapsed is negative');
      return 0;
    }

    if (time_since_last_fetch < options.recency_period) {
      console.debug('Poll ran too recently');
      return 0;
    }
  }

  // Fetch the feed
  const fetch_options = {};
  fetch_options.timeout = options.fetch_feed_timeout;
  fetch_options.skip_entries = false;
  fetch_options.resolve_entry_urls = true;
  const skip_entries = false;
  const resolve_entry_urls = true;

  // TODO: fetch feed yields an object, not a Response, and I confused myself
  // already. Rename response here to fetch_result

  let response;
  try {
    response = await net.fetch_feed(tail_url, fetch_options);
  } catch (error) {
    // Never swallow assertion errors
    if (error instanceof AssertionError) {
      throw error;
    }

    await handle_fetch_feed_error(
        session, error, feed, options.deactivation_threshold);
    console.warn('poll-feed fetch error', cdb.feed_get_url(feed), error);
    return 0;
  }

  assert(typeof response === 'object');

  // Temp: debugging
  if (!(response.http_response instanceof Response)) {
    console.warn('Invalid response fetching feed');
    console.dir(response);
    return 0;
  }


  const merged_feed = merge_feed(feed, response.feed);

  // If we were successful, ensure that the error metrics are updated
  if ('errorCount' in merged_feed) {
    if (typeof merged_feed.errorCount === 'number') {
      if (merged_feed.errorCount > 0) {
        merged_feed.errorCount--;
      }
    } else {
      delete merged_feed.errorCount;
    }
  }

  cdb.validate_feed(merged_feed);
  cdb.sanitize_feed(merged_feed);

  console.debug('Updating feed in db', cdb.feed_get_url(feed));
  await cdb.update_feed(session, merged_feed, true);

  // const count = await poll_entries(
  //    session, iconn, rewrite_rules, options, response.entries, merged_feed);

  const feed_url_string = cdb.feed_get_url(merged_feed);

  // TEMP: investigating poll issue
  console.debug(
      'Polling %d entries for feed', response.entries.length, feed_url_string);

  const coerced_entries = entries.map(coerce_entry);
  const entries = dedup_entries(coerced_entries);

  // Propagate feed properties to entries
  for (const entry of entries) {
    entry.feed = merged_feed.id;
    entry.feedTitle = merged_feed.title;
    entry.faviconURLString = merged_feed.faviconURLString;
    if (merged_feed.datePublished && !entry.datePublished) {
      entry.datePublished = merged_feed.datePublished;
    }
  }

  // TEMP: track index of each entry for debugging
  let entry_index = 0;

  // Concurrently poll all entries
  const poll_entry_promises = entries.map(entry => {
    const promise = poll_entry(
        session, iconn, entry, options.fetch_html_timeout,
        options.fetch_image_timeout, rewrite_rules, feed_url_string,
        entry_index, entries.length);
    entry_index++;
    return promise;
  });

  const new_entry_ids = await Promise.all(poll_entry_promises);
  const count = new_entry_ids.reduce((sum, v) => v ? sum + 1 : sum, 0);

  if (options.notify && count) {
    const notif = {};
    notif.title = 'Added articles';
    notif.message =
        'Added ' + count + ' articles for feed ' + merged_feed.title;
    note.show(notif);
  }

  console.debug(
      'Completed polling feed %s, added %d entries', cdb.feed_get_url(feed),
      count);
  return count;
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

async function handle_fetch_feed_error(session, error, feed, threshold) {
  // Avoid incrementing error count for programming error
  if (error instanceof AssertionError) {
    // TEMP: researching issue in case error swallowed
    console.error('Assertion error', error);

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
      'Incremented error count for feed', cdb.feed_get_url(feed),
      feed.errorCount, error);

  // Auto-deactivate on threshold breach
  if (feed.errorCount > threshold) {
    console.debug('Deactivating feed', cdb.feed_get_url(feed));
    feed.active = false;
    feed.deactivationReasonText = 'fetch';
    feed.deactivationDate = new Date();
  }

  console.debug('updating feed in handle-fetch-error');
  // No need to validate/sanitize, we've had control for the entire lifetime
  await cdb.update_feed(session, feed, true);
}

function dedup_entries(entries) {
  assert(Array.isArray(entries));

  const distinct_entries = [];
  const seen_url_strings = [];

  for (const entry of entries) {
    if (!entry) {
      console.warn('Skipping undefined entry in entries list');
      continue;
    }

    // TODO: use cdb.entry_has_url
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

      // TODO: do not naively push all, that makes seen grow larger than it
      // needs to be because it creates dupes
      seen_url_strings.push(...entry.urls);
    }
  }

  return distinct_entries;
}

// Convert a parsed entry into a cdb-formatted entry
function coerce_entry(parsed_entry) {
  const blank_entry = cdb.construct_entry();

  // TODO: now that this function is no longer in a separate lib, maybe the
  // clone is just silly.

  // Clone to avoid mutation
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
// TODO: there are just too many parameters to this function
export async function poll_entry(
    session, iconn, entry, fetch_html_timeout, fetch_image_timeout,
    rewrite_rules, feed_url_string, entry_index, num_entries) {
  assert(cdb.is_entry(entry));
  // TODO: implement and use cdb.entry_has_url
  assert(Array.isArray(entry.urls) && entry.urls.length);

  // TODO: implement and use cdb.entry_get_url
  console.debug(
      'Polling entry', entry.urls[entry.urls.length - 1], entry_index,
      num_entries);

  // TODO: implement and use cdb.entry_get_url
  let url = new URL(entry.urls[entry.urls.length - 1]);
  cdb.append_entry_url(entry, rewrite_url(url, rewrite_rules));

  url = new URL(entry.urls[entry.urls.length - 1]);
  let existing_entry = await cdb.get_entry(session, 'url', url, true);
  if (existing_entry) {
    console.debug('entry already exists', url.href);
    return 0;
  }

  // Fetch the entry full text. Reuse the url from above since it has not
  // changed. Trap fetch errors so that we can fall back to using feed content
  let response;
  if ((url.protocol === 'http:' || url.protocol === 'https:') &&
      sniff.classify(url) !== sniff.BINARY_CLASS && !url_is_inaccessible(url)) {
    try {
      console.debug('Poll entry fetch', url.href, fetch_html_timeout);
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
        console.debug('entry redirect already exists', url.href);
        return 0;
      }
    }

    let response_text;
    try {
      response_text = await response.text();
      document = utils.parse_html(response_text);
    } catch (error) {
      if (error instanceof AssertionError) {
        throw error;
      } else {
        console.debug(error);
      }
    }
  } else {
    try {
      document = utils.parse_html(entry.content);
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

  // TODO: this could also be the source of the hang
  console.debug('Setting entry favicon', entry.urls[entry.urls.length - 1]);
  const lookup_url = new URL(entry.urls[entry.urls.length - 1]);
  const lookup_request = new favicon.LookupRequest();
  lookup_request.conn = iconn;
  lookup_request.url = lookup_url;
  lookup_request.document = document;
  const icon_url_string = await favicon.lookup(lookup_request);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
  console.debug(
      'Completed entry set favicon', entry.urls[entry.urls.length - 1]);


  dom_utils.set_base_uri(document, url);

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

  // TEMP: researching issue with poll hanging
  console.debug(
      'Filtering document for entry', entry.urls[entry.urls.length - 1]);

  await dom_filters.composite_document_filter(document, filter_options);

  console.debug(
      'Filtered document for entry', entry.urls[entry.urls.length - 1]);

  assert(
      document.documentElement,
      'document is missing document element? ' + document);

  entry.content = document.documentElement.outerHTML;
  cdb.sanitize_entry(entry);
  cdb.validate_entry(entry);

  console.debug('Storing entry in db', entry.urls[entry.urls.length - 1]);
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
