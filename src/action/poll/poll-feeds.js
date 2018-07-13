import * as favicon from '/src/action/favicon/favicon.js';
import {build_rewrite_rules} from '/src/action/poll/rewrite-rules.js';
import {sanitize_document} from '/src/action/poll/sanitize-document.js';
import * as app from '/src/app.js';
import * as array from '/src/lib/array.js';
import assert from '/src/lib/assert.js';
import {set_base_uri} from '/src/lib/html-document.js';
import * as html from '/src/lib/html.js';
import * as ls from '/src/lib/ls.js';
import {fetch_feed} from '/src/lib/net/fetch-feed.js';
import {fetch_html} from '/src/lib/net/fetch-html.js';
import {OfflineError, TimeoutError} from '/src/lib/net/fetch2.js';
import * as sniff from '/src/lib/net/sniff.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {rewrite_url} from '/src/lib/rewrite-url.js';
import * as sanity from '/src/model/model-sanity.js';
import * as Model from '/src/model/model.js';

const default_options = {
  ignore_recency_check: false,
  recency_period: 5 * 60 * 1000,
  fetch_feed_timeout: 5000,
  fetch_html_timeout: 5000,
  fetch_image_timeout: 3000,
  deactivation_threshold: 10,
  notify: true
};

export async function poll_feeds(ma, iconn, options = {}) {
  const get_feeds_mode = 'active', get_feeds_sort = false;
  const feeds = await ma.getFeeds(get_feeds_mode, get_feeds_sort);

  options = Object.assign({}, default_options, options);

  // Concurrently poll feeds, skipping individual errors
  const promises = [];
  for (const feed of feeds) {
    const promise = poll_feed(ma, iconn, options, feed);
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
export async function poll_feed(ma, iconn, options = {}, feed) {
  const ignore_recency_check = options.ignore_recency_check;
  const recency_period = options.recency_period;
  const notify_flag = options.notify;
  const threshold = options.deactivation_threshold;
  const fetch_feed_timeout = options.fetch_feed_timeout;

  assert(Model.is_feed(feed));
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

  // Fetch the feed
  const skip_entries = false;
  const resolve_entry_urls = true;
  let response;
  try {
    response = await fetch_feed(
        tail_url, fetch_feed_timeout, skip_entries, resolve_entry_urls);
  } catch (error) {
    await handle_fetch_error(ma, error, feed, threshold);
    return 0;
  }

  // Integrate the previous feed data with the new feed data
  const merged_feed = merge_feed(feed, response.feed);

  // Denote the fetch was successful. This is important to counteract error
  // counters that would lead to eventual deactivation
  handle_fetch_success(merged_feed);

  sanity.validate_feed(merged_feed);
  sanity.sanitize_feed(merged_feed);
  await ma.updateFeed(merged_feed);

  const count =
      await poll_entries(ma, iconn, options, response.entries, merged_feed);

  if (notify_flag && count) {
    const title = 'Added articles';
    const message =
        'Added ' + count + ' articles for feed ' + merged_feed.title;
    app.show_notification(title, message);
  }

  return count;
}

async function poll_entries(ma, iconn, options, entries, feed) {
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

  // TODO: this collection of rules should not be rebuilt per feed, so rules
  // should be a parameter to this function
  const rewrite_rules = build_rewrite_rules();

  const poll_entry_promises = [];
  for (const entry of entries) {
    const promise = poll_entry(
        ma, iconn, entry, options.fetch_html_timeout,
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

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference. Internally, after assignment, the merged
// feed has only the urls from the new feed. So the output feed's url array
// needs to be fixed. First copy over the old feed's urls, then try and append
// each new feed url.
function merge_feed(old_feed, new_feed) {
  const merged_feed = Object.assign(Model.create_feed(), old_feed, new_feed);
  merged_feed.urls = [...old_feed.urls];
  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      Model.append_feed_url(merged_feed, new URL(url_string));
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

async function handle_fetch_error(ma, error, feed, threshold) {
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
    console.debug('Deactivating feed', array.peek(feed.urls));
    feed.active = false;
    feed.deactivationReasonText = 'fetch';
    feed.deactivationDate = new Date();
  }

  // No need to validate/sanitize, we've had control for the entire lifetime
  await ma.updateFeed(feed);
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
  const blank_entry = Model.create_entry();

  // Copy over everything
  const clone = Object.assign(blank_entry, parsed_entry);

  // Then convert the link property to a url in the urls property
  delete clone.link;
  if (parsed_entry.link) {
    try {
      Model.append_entry_url(clone, new URL(parsed_entry.link));
    } catch (error) {
    }
  }

  return clone;
}

// Processes an entry and possibly adds it to the database. Attempts to fetch
// the full text of the entry. Either returns the added entry id, or throws an
// error.
export async function poll_entry(
    ma, iconn, entry, fetch_html_timeout, fetch_image_timeout, rewrite_rules,
    feed_url_string) {
  assert(Model.is_entry(entry));

  // Rewrite the entry's last url and append its new url if different.
  let url = new URL(array.peek(entry.urls));
  Model.append_entry_url(entry, rewrite_url(url, rewrite_rules));

  // TEMP: researching problem with fetching hacker news articles
  // OK, the entry tail url is the desired url that came from the entry link,
  // so something incorrect must be happening after this
  if (feed_url_string.startsWith('https://news.ycombinator.com/rss')) {
    console.dir(entry);
  }

  // Check whether the entry exists. Note we skip over checking the original
  // url and only check the rewritten url, because we always rewrite before
  // storage, and that is sufficient to detect a duplicate. We get the
  // tail url a second time because it may have changed in rewriting.
  url = new URL(array.peek(entry.urls));

  let existing_entry = await ma.getEntry('url', url, true);
  if (existing_entry) {
    // NOTE: this only fails this entry, throwing this error does not cause
    // the other entries to be skipped
    throw new EntryExistsError('Entry already exists for url ' + url.href);
  }

  // TEMP: researching problem with fetching hacker news articles
  // OK, all found here
  if (feed_url_string.startsWith('https://news.ycombinator.com/rss')) {
    console.debug('entry does not exist', url.href);
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


  // TEMP: this could be one reason why this is failing to fetch hacker news
  // articles
  if (feed_url_string.startsWith('https://news.ycombinator.com/rss') &&
      !response) {
    console.debug('no response for hacker news article', url.href);
  }

  const get_mode = 'url', key_only = true;

  // If we fetched and redirected, append the post-redirect response url, and
  // reapply url rewriting.
  let document;
  if (response) {
    let url_changed = false;
    const response_url = new URL(response.url);
    if (url_did_change(url, response_url)) {
      url_changed = true;
      Model.append_entry_url(entry, response_url);
      Model.append_entry_url(entry, rewrite_url(response_url, rewrite_rules));
      url = new URL(array.peek(entry.urls));
      existing_entry = await ma.getEntry(get_mode, url, key_only);
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
  await sanitize_document(document);
  entry.content = document.documentElement.outerHTML;

  sanity.sanitize_entry(entry);
  sanity.validate_entry(entry);

  // TEMP: look at whether this pulled the full text or fell back to the
  // original, it should have grabbed the full text
  if (feed_url_string.startsWith('https://news.ycombinator.com/rss')) {
    console.debug('Creating hacker news entry', entry);
  }

  return ma.createEntry(entry);
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
  const lookup_url = new URL(array.peek(entry.urls));
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
