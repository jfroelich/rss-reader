import * as favicon_service from '/src/favicon-service/favicon-service.js';
import * as feed_parser from '/src/feed-parser/feed-parser.js';
import * as fetchlib from '/src/fetch/fetch.js';
import * as notifications from '/src/notifications/notifications.js';
import {PollService} from '/src/poll-service/poll-service.js';
import {coerce_feed} from '/src/rdb/coerce-feed.js';
import * as rdb from '/src/rdb/rdb.js';

export function SubscribeOperation() {
  this.rconn = null;
  this.iconn = null;
  this.channel = null;
  this.fetch_timeout = 2000;
  this.notify_flag = false;
  this.console = null_console;
}

// Returns undefined on error
SubscribeOperation.prototype.subscribe = async function(url) {
  assert(this.rconn);
  assert(this.iconn);
  assert(url instanceof URL);
  assert(this.console);

  this.console.log('Subscribing to feed', url.href);

  if (await rdb.contains_feed_with_url(this.rconn, url)) {
    this.console.debug('Already subscribed to feed ', url.href);
    return;
  }

  let response = await fetchlib.fetch_feed(url, this.fetch_timeout);
  if (!response.ok) {
    this.console.debug(
        'Failed to fetch feed', url.href, response.status, response.statusText);
    return;
  }

  // previously subscribe_create_feed_from_response
  // note args changed
  const feed = await this.create_feed(response, url);
  if (!feed) {
    this.console.debug('Failed to create feed', url.href);
    return;
  }

  // previously subscribe_feed_set_favicon, note args changed
  await this.set_favicon(feed);

  const stored_feed = await rdb.feed_add(this.rconn, this.channel, feed);
  if (this.notify_flag) {
    this.show_notification(stored_feed);
  }

  this.poll_feed(stored_feed).catch(this.console.warn);  // non-blocking
  return stored_feed;
};

SubscribeOperation.prototype.create_feed = async function(response, url) {
  const response_url = new URL(response.url);

  // If there was a redirect, then check if subscribed to the redirect
  if (fetchlib.url_did_change(url, response_url) &&
      await rdb.contains_feed_with_url(this.rconn, response_url)) {
    this.console.debug(
        'Already subscribed to feed redirect', url.href, response_url.href);
    return;
  }

  const response_text = await response.text();

  let parsed_feed;
  const skip_entries = true;
  const resolve_urls = false;
  try {
    parsed_feed = feed_parser.parse(response_text, skip_entries, resolve_urls);
  } catch (error) {
    this.console.debug('Failed to parse feed', url.href, error);
    return;
  }

  const ops = {};
  ops.request_url = url;
  ops.response_url = response_url;
  ops.response_last_modified_date =
      fetchlib.response_get_last_modified_date(response);
  return coerce_feed(parsed_feed, ops);
};

SubscribeOperation.prototype.set_favicon = async function(feed) {
  assert(rdb.is_feed(feed));
  const query = {};
  query.conn = this.iconn;
  query.skipURLFetch = true;
  query.url = rdb.feed_create_favicon_lookup_url(feed);
  feed.faviconURLString = await favicon_service.lookup(query);
};

SubscribeOperation.prototype.show_notification = function(feed) {
  const title = 'Subscribed!';
  const feed_title = feed.title || rdb.feed_peek_url(feed);
  const message = 'Subscribed to ' + feed_title;
  notifications.show(title, message, feed.faviconURLString);
};

SubscribeOperation.prototype.poll_feed = async function(feed) {
  const service = new PollService();
  service.ignore_recency_check = true;
  service.ignore_modified_check = true;
  service.notify = false;
  await service.init(this.channel);
  await service.poll_feed(feed);
  service.close(/* close_channel */ false);
};

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

function noop() {}

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};
