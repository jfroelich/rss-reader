import {entry_append_url} from '/src/app/objects/entry.js';
import {feed_prepare} from '/src/app/objects/feed.js';
import {create_entry} from '/src/app/operations/create-entry.js';
import {update_feed} from '/src/app/operations/update-feed.js';
import * as badge from '/src/badge.js';
import * as color from '/src/color/color.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';
import * as feed_parser from '/src/feed-parser/feed-parser.js';
import * as html_parser from '/src/html-parser/html-parser.js';
import * as notifications from '/src/notifications/notifications.js';
import {dedup_entries} from '/src/poll-service/dedup-entries.js';
import {filter_entry_content} from '/src/poll-service/filter-entry-content.js';
import {coerce_entry} from '/src/rdb/coerce-entry.js';
import {coerce_feed} from '/src/rdb/coerce-feed.js';
import * as rdb from '/src/rdb/rdb.js';
import {rewrite_url} from '/src/rewrite-url/rewrite-url.js';
import * as sniff from '/src/sniff/sniff.js';
import * as url_loader from '/src/url-loader/url-loader.js';

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};

const rewrite_urls = build_rewrite_rules();

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

export function PollService() {
  this.rconn = null;
  this.iconn = null;
  this.channel = null;
  this.ignore_recency_check = false;
  this.ignore_modified_check = false;
  this.recency_period = 5 * 60 * 1000;
  this.fetch_feed_timeout = 5000;
  this.fetch_html_timeout = 5000;
  this.fetch_image_timeout = 3000;
  this.deactivation_threshold = 10;
  this.console = null_console;
  this.badge_update = true;
  this.notify = true;
}

PollService.prototype.init = async function(channel) {
  const fs = new FaviconService();
  const promises = [rdb.open(), fs.open()];
  [this.rconn, this.iconn] = await Promise.all(promises);
  this.channel = channel;
};

PollService.prototype.close = function(close_channel) {
  if (this.rconn) {
    this.rconn.close();
  }

  if (this.iconn) {
    this.iconn.close();
  }

  if (close_channel && this.channel) {
    this.channel.close();
  }
};

PollService.prototype.poll_feeds = async function() {
  this.console.log('Polling feeds...');

  assert(this.rconn instanceof IDBDatabase);
  assert(this.iconn instanceof IDBDatabase);

  if (this.channel) {
    assert(this.channel instanceof BroadcastChannel);
  }

  const feeds = await rdb.find_active_feeds(this.rconn);
  const proms = feeds.map(this.poll_feed, this);
  const results = await Promise.all(proms);
  const count = results.reduce((sum, value) => {
    return isNaN(value) ? sum : sum + value;
  }, 0);

  if (count) {
    badge.update(this.rconn).catch(console.error);

    const title = 'Added articles';
    const message = 'Added articles';
    notifications.show(title, message);
  }

  this.console.log('Run completed, added %d entries', count);
};


PollService.prototype.poll_feed = async function(feed) {
  assert(rdb.is_feed(feed));
  assert(rdb.feed_has_url(feed));

  const tail_url = new URL(rdb.feed_peek_url(feed));
  this.console.log('Polling feed', feed.title, tail_url.href);

  if (!feed.active) {
    return 0;
  }

  if (this.polled_recently(feed)) {
    this.console.debug('Feed polled too recently', tail_url.href);
    return 0;
  }

  const response =
      await url_loader.fetch_feed(tail_url, this.fetch_feed_timeout);
  if (!response.ok) {
    this.handle_error(response.status, feed, 'fetch');
    return 0;
  }

  const feed_lmd = feed.dateLastModified;
  const resp_lmd = new Date(response.headers.get('Last-Modified'));

  if (!this.ignore_modified_check && feed_lmd && resp_lmd &&
      feed_lmd.getTime() !== resp_lmd.getTime()) {
    this.console.debug('No modification detected', tail_url.href);
    const dirty = this.handle_fetch_success(feed);
    if (dirty) {
      feed.dateUpdated = new Date();
      await update_feed(this.rconn, this.channel, feed);
    }
    return 0;
  }

  const response_text = await response.text();
  const skip_entries = false, resolve_urls = true;
  let parsed_feed;
  try {
    parsed_feed = feed_parser.parse(response_text, skip_entries, resolve_urls);
  } catch (error) {
    this.handle_error(/* status */ undefined, feed, 'parse');
    return 0;
  }

  const response_url = new URL(response.url);

  const fetch_info = {
    request_url: tail_url,
    response_url: response_url,
    response_last_modified_date: resp_lmd
  };

  const coerced_feed = coerce_feed(parsed_feed, fetch_info);
  const merged_feed = rdb.feed_merge(feed, coerced_feed);
  this.handle_fetch_success(merged_feed);

  const storable_feed = feed_prepare(merged_feed);
  storable_feed.dateUpdated = new Date();
  await update_feed(this.rconn, this.channel, storable_feed);

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

  const proms = entries.map(this.poll_entry, this);
  const entry_ids = await Promise.all(proms);
  const count = entry_ids.reduce((sum, v) => v ? sum + 1 : sum, 0);

  if (this.badge_update && count) {
    badge.update(this.rconn).catch(console.error);
  }

  if (this.notify && count) {
    const title = 'Added articles';
    const message =
        'Added ' + count + ' articles for feed ' + storable_feed.title;
    notifications.show(title, message);
  }

  return count;
};

PollService.prototype.polled_recently = function(feed) {
  if (this.ignore_recency_check) {
    return false;
  }
  if (!feed.dateFetched) {
    return false;
  }

  const current_date = new Date();
  const elapsed_ms = current_date - feed.dateFetched;
  assert(elapsed_ms >= 0, 'Polled feed in future??');
  return elapsed_ms < this.recency_period;
};

PollService.prototype.handle_fetch_success = function(feed) {
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
};

PollService.prototype.handle_error = function(status, feed, type) {
  if (status === url_loader.STATUS_TIMEOUT ||
      status === url_loader.STATUS_OFFLINE) {
    return;
  }

  feed.errorCount = Number.isInteger(feed.errorCount) ? feed.errorCount + 1 : 1;
  if (feed.errorCount > this.deactivation_threshold) {
    feed.active = false;
    feed.deactivationReasonText = type;
    feed.deactivationDate = new Date();
  }

  feed.dateUpdated = new Date();
  update_feed(this.rconn, this.channel, feed).catch(console.error);
};

PollService.prototype.poll_entry = async function(entry) {
  if (!rdb.entry_has_url(entry)) {
    return;
  }

  entry_rewrite_tail_url(entry);
  if (await this.entry_exists(entry)) {
    return;
  }

  const response = await this.fetch_entry(entry);
  if (await this.handle_entry_redirect(entry, response)) {
    return;
  }

  const document = await entry_parse_response(response);
  entry_update_title(entry, document);
  await this.update_entry_icon(entry, document);
  await this.update_entry_content(entry, document);

  let stored_entry;
  try {
    stored_entry = await create_entry(this.rconn, this.channel, entry);
  } catch (error) {
    return;
  }

  return stored_entry.id;
};

PollService.prototype.entry_exists = function(entry) {
  const url = new URL(rdb.entry_peek_url(entry));
  return rdb.contains_entry_with_url(this.rconn, url);
};

PollService.prototype.fetch_entry = async function(entry) {
  const url = new URL(rdb.entry_peek_url(entry));
  if (url_is_augmentable(url)) {
    const response = await url_loader.fetch_html(url, this.fetch_html_timeout);
    if (response.ok) {
      return response;
    }
  }
};

PollService.prototype.handle_entry_redirect = async function(entry, response) {
  if (!response) {
    return false;
  }

  const request_url = new URL(rdb.entry_peek_url(entry));
  const response_url = new URL(response.url);
  if (!url_loader.url_did_change(request_url, response_url)) {
    return false;
  }

  entry_append_url(entry, response_url);
  entry_rewrite_tail_url(entry);
  return await this.entry_exists(entry);
};

PollService.prototype.update_entry_icon = async function(entry, document) {
  const entry_url = new URL(rdb.entry_peek_url(entry));

  const fs = new FaviconService();
  fs.conn = this.iconn;
  fs.skip_fetch = true;

  const icon_url_string = await fs.lookup(entry_url, document);
  if (icon_url_string) {
    entry.faviconURLString = icon_url_string;
  }
};

PollService.prototype.update_entry_content = async function(entry, document) {
  if (!document) {
    try {
      document = html_parser.parse(entry.content);
    } catch (error) {
      entry.content = 'Bad formatting (unsafe HTML redacted)';
      return;
    }
  }

  const document_url = new URL(rdb.entry_peek_url(entry));
  const opts = {
    fetch_image_timeout: this.fetch_image_timeout,
    matte: color.WHITE,
    min_contrast_ratio: localStorage.MIN_CONTRAST_RATIO,
    emphasis_length_max: 200
  };
  await filter_entry_content(document, document_url, opts);
  entry.content = document.documentElement.outerHTML;
};

function entry_rewrite_tail_url(entry) {
  const tail_url = new URL(rdb.entry_peek_url(entry));
  const new_url = rewrite_url(tail_url, rewrite_urls);
  if (!new_url) {
    return false;
  }
  return entry_append_url(entry, new_url);
}

async function entry_parse_response(response) {
  if (!response) {
    return;
  }

  try {
    const response_text = await response.text();
    return html_parser.parse(response_text);
  } catch (error) {
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

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
