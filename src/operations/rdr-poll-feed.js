import * as color from '/src/lib/color/color.js';
import * as feed_parser from '/src/lib/feed-parser/feed-parser.js';
import * as html_parser from '/src/lib/html-parser/html-parser.js';
import {rewrite_url} from '/src/lib/rewrite-url/rewrite-url.js';
import * as sniff from '/src/lib/sniff/sniff.js';
import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {coerce_entry, entry_append_url, entry_has_url, entry_is_valid_id, entry_peek_url} from '/src/objects/entry.js';
import {coerce_feed, feed_has_url, feed_merge, feed_peek_url, feed_prepare, is_feed} from '/src/objects/feed.js';
import {create_entry} from '/src/operations/create-entry.js';
import {find_entry_id_by_url} from '/src/operations/find-entry-id-by-url.js';
import {rdr_badge_refresh} from '/src/operations/rdr-badge-refresh.js';
import {rdr_fetch_feed} from '/src/operations/rdr-fetch-feed.js';
import {rdr_fetch_html} from '/src/operations/rdr-fetch-html.js';
import {rdr_lookup_icon} from '/src/operations/rdr-lookup-icon.js';
import {rdr_notify} from '/src/operations/rdr-notify.js';
import {rdr_transform_document} from '/src/operations/rdr-transform-document.js';
import {update_feed} from '/src/operations/update-feed.js';

// TODO: move poll-entry to its own operations module

const rewrite_rules = build_rewrite_rules();

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


  // BUG: something is wrong here, this is basically failing 100% of the time
  // when ignore_modified_check is false, with both modified dates being the
  // same value. Perhaps I am not updating the feed.dateLastModified value
  // correctly? Perhaps I should use a hash? Perhaps I should just not even
  // bother with the check?
  //
  // It looks like in the refactoring I somehow lost updating the the
  // dateLastModified field per fetch

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

  console.debug(
      'Processing %d entries for feed', parsed_feed.entries.length,
      tail_url.href);

  const coerced_entries = parsed_feed.entries.map(coerce_entry);
  const entries = dedup_entries(coerced_entries);

  for (const entry of entries) {
    entry.feed = storable_feed.id;
    entry.feedTitle = storable_feed.title;
    entry.faviconURLString = storable_feed.faviconURLString;

    if (storable_feed.datePublished && !entry.datePublished) {
      entry.datePublished = storable_feed.datePublished;
    }
  }

  const poll_entry_partial =
      poll_entry.bind(null, rconn, iconn, channel, console, options);

  const proms = entries.map(poll_entry_partial);
  const entry_ids = await Promise.all(proms);
  const count = entry_ids.reduce((sum, v) => v ? sum + 1 : sum, 0);

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

async function poll_entry(rconn, iconn, channel, console, options, entry) {
  const fetch_html_timeout = options.fetch_html_timeout;
  const fetch_image_timeout = options.fetch_image_timeout;

  if (!entry_has_url(entry)) {
    return;
  }

  entry_rewrite_tail_url(entry, rewrite_rules);
  if (await entry_exists(rconn, entry)) {
    return;
  }

  const response = await fetch_entry(entry, fetch_html_timeout);
  if (await handle_entry_redirect(rconn, entry, response, rewrite_rules)) {
    return;
  }

  const document = await entry_parse_response(response);
  entry_update_title(entry, document);
  await update_entry_icon(iconn, console, entry, document);
  await update_entry_content(entry, document, console, fetch_image_timeout);

  const stored_entry = await create_entry(rconn, channel, console, entry);
  return stored_entry.id;
}

async function handle_entry_redirect(rconn, entry, response, rewrite_rules) {
  if (!response) {
    return false;
  }

  const request_url = new URL(entry_peek_url(entry));
  const response_url = new URL(response.url);
  if (!url_loader.url_did_change(request_url, response_url)) {
    return false;
  }

  entry_append_url(entry, response_url);
  entry_rewrite_tail_url(entry, rewrite_rules);
  return await entry_exists(rconn, entry);
}

function entry_rewrite_tail_url(entry, rewrite_rules) {
  const tail_url = new URL(entry_peek_url(entry));
  const new_url = rewrite_url(tail_url, rewrite_rules);
  if (!new_url) {
    return false;
  }
  return entry_append_url(entry, new_url);
}

async function entry_exists(rconn, entry) {
  const url = new URL(entry_peek_url(entry));
  const id = await find_entry_id_by_url(rconn, url);
  return entry_is_valid_id(id);
}

// TODO: i think this should always return a response, so instead of returning
// undefined if not augmentable, return a stub error promise
// TODO: undecided, but maybe augmentability is not this function's concern?
async function fetch_entry(entry, fetch_html_timeout) {
  const url = new URL(entry_peek_url(entry));
  if (url_is_augmentable(url)) {
    const response = await rdr_fetch_html(url, fetch_html_timeout);
    if (response.ok) {
      return response;
    }
  }
}

function url_is_augmentable(url) {
  return url_is_http(url) && sniff.classify(url) !== sniff.BINARY_CLASS &&
      !url_is_inaccessible_content(url);
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

async function entry_parse_response(response) {
  if (!response) {
    return;
  }

  const response_text = await response.text();

  try {
    return html_parser.parse(response_text);
  } catch (error) {
  }
}

function entry_update_title(entry, document) {
  if (document && !entry.title) {
    const title_element = document.querySelector('html > head > title');
    if (title_element) {
      entry.title = title_element.textContent;
    }
  }
}

async function update_entry_icon(iconn, console, entry, document) {
  const lookup_url = new URL(entry_peek_url(entry));
  const skip_fetch = true;
  const icon_url_string =
      await rdr_lookup_icon(iconn, console, skip_fetch, lookup_url);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
}

async function update_entry_content(
    entry, document, console, fetch_image_timeout) {
  if (!document) {
    try {
      document = html_parser.parse(entry.content);
    } catch (error) {
      entry.content = 'Bad formatting (unsafe HTML redacted)';
      return;
    }
  }

  const document_url = new URL(entry_peek_url(entry));
  const opts = {
    fetch_image_timeout: fetch_image_timeout,
    matte: color.WHITE,
    min_contrast_ratio: localStorage.MIN_CONTRAST_RATIO,
    emphasis_length_max: 200
  };

  await rdr_transform_document(document, document_url, console, opts);
  entry.content = document.documentElement.outerHTML;
}

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
