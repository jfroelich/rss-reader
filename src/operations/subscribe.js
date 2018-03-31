import {FaviconService} from '/src/lib/favicon-service/favicon-service.js';
import * as feed_parser from '/src/lib/feed-parser/feed-parser.js';
import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {coerce_feed, feed_create_favicon_lookup_url, feed_peek_url, is_feed} from '/src/objects/feed.js';
import {contains_feed_with_url} from '/src/operations/contains-feed-with-url.js';
import {create_feed} from '/src/operations/create-feed.js';
import {PollService} from '/src/operations/poll-service/poll-service.js';
import {rdr_fetch_feed} from '/src/operations/rdr-fetch-feed.js';
import {rdr_notify} from '/src/operations/rdr-notify.js';

export async function rdr_subscribe(
    rconn, iconn, channel, console = null_console, fetch_timeout = 2000,
    notify_flag = false, url) {
  console.log('Subscribing to feed', url.href);

  if (await contains_feed_with_url(rconn, url)) {
    console.debug('Already subscribed to', url.href);
    return;
  }

  const response = await rdr_fetch_feed(url, fetch_timeout);
  if (!response.ok) {
    console.debug('Fetch error', url.href, response.status);
    return;
  }

  const response_url = new URL(response.url);

  // Check if subscribed to redirect
  if (url_loader.url_did_change(url, response_url) &&
      await contains_feed_with_url(rconn, response_url)) {
    console.debug(
        'Already subscribed to feed redirect', url.href, response_url.href);
    return;
  }

  // Deserialize the response body
  const response_text = await response.text();
  let parsed_feed;
  const skip_entries = true;
  const resolve_urls = false;
  try {
    parsed_feed = feed_parser.parse(response_text, skip_entries, resolve_urls);
  } catch (error) {
    console.debug('Parse error', url.href, error);
    return;
  }

  // Convert from parsed format to storage format
  const lmd = new Date(response.headers.get('Last-Modified'));
  const feed = coerce_feed(parsed_feed, {
    request_url: url,
    response_url: response_url,
    response_last_modified_date: lmd.getTime() === NaN ? null : lmd
  });

  // Set the favicon
  const fs = new FaviconService();
  fs.conn = iconn;
  fs.console = console;
  fs.skip_fetch = true;
  const lookup_url = feed_create_favicon_lookup_url(feed);
  feed.faviconURLString = await fs.lookup(lookup_url);

  const stored_feed = await create_feed(rconn, channel, feed);

  if (notify_flag) {
    const title = 'Subscribed!';
    const feed_title = feed.title || feed_peek_url(stored_feed);
    const message = 'Subscribed to ' + feed_title;
    rdr_notify(title, message, stored_feed.faviconURLString);
  }

  poll_feed_unawaited(channel, stored_feed);

  return stored_feed;
}

async function poll_feed_unawaited(channel, feed) {
  const ps = new PollService();
  ps.ignore_recency_check = true;
  ps.ignore_modified_check = true;
  ps.notify = false;
  await ps.init(channel);
  await ps.poll_feed(feed);
  ps.close(/* close_channel */ false);
}

function noop() {}

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};
