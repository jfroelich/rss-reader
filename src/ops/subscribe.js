import {console_stub} from '/src/lib/console-stub/console-stub.js';
import * as feed_parser from '/src/lib/feed-parser/feed-parser.js';
import {list_peek} from '/src/lib/list/list.js';
import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {coerce_feed, feed_append_url, feed_create, feed_create_favicon_lookup_url, is_feed} from '/src/objects/feed.js';
import {rdr_contains_feed} from '/src/ops/rdr-contains-feed.js';
import {rdr_create_channel} from '/src/ops/rdr-create-channel.js';
import {rdr_create_conn} from '/src/ops/rdr-create-conn.js';
import {rdr_create_feed} from '/src/ops/rdr-create-feed.js';
import {rdr_create_icon_conn} from '/src/ops/rdr-create-icon-conn.js';
import {rdr_fetch_feed} from '/src/ops/rdr-fetch-feed.js';
import {rdr_lookup_icon} from '/src/ops/rdr-lookup-icon.js';
import {rdr_notify} from '/src/ops/rdr-notify.js';
import {rdr_poll_feed} from '/src/ops/rdr-poll-feed.js';

export async function rdr_subscribe(
    rconn, iconn, channel, console = console_stub, fetch_timeout = 2000,
    notify_flag = false, url) {
  console.log('Subscribing to feed', url.href);

  let does_feed_exist = await rdr_contains_feed(rconn, {url: url});
  if (does_feed_exist) {
    console.debug('url exists', url.href);
    return;
  }

  const response = await rdr_fetch_feed(url, fetch_timeout);
  if (!response.ok) {
    console.debug('Fetch error', url.href, response.status);
    return;
  }

  const response_url = new URL(response.url);

  // If redirected, check if the redirect url exists
  if (url_loader.url_did_change(url, response_url)) {
    does_feed_exist = await rdr_contains_feed(rconn, {url: response_url});
    if (does_feed_exist) {
      console.debug('redirect url exists', url.href, response_url.href);
      return;
    }
  }

  const parsed_feed = await parse_response_body(response, console);
  if (!parsed_feed) {
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
  const lookup_url = feed_create_favicon_lookup_url(feed);
  feed.faviconURLString =
      await rdr_lookup_icon(iconn, console, true, lookup_url);

  const sanitize = true;
  const stored_feed =
      await rdr_create_feed(rconn, channel, console, feed, sanitize);

  if (notify_flag) {
    const title = 'Subscribed!';
    const feed_title = feed.title || list_peek(stored_feed.urls);
    const message = 'Subscribed to ' + feed_title;
    rdr_notify(title, message, stored_feed.faviconURLString);
  }

  poll_feed_unawaited(console, stored_feed);

  return stored_feed;
}

async function parse_response_body(response, console) {
  let parsed_feed;
  const skip_entries = true;
  const resolve_urls = false;

  const response_text = await response.text();

  try {
    parsed_feed = feed_parser.parse(response_text, skip_entries, resolve_urls);
  } catch (error) {
    console.debug('Parse error', response.url, error);
  }

  return parsed_feed;
}

async function poll_feed_unawaited(console, feed) {
  const rconn = await rdr_create_conn();
  const iconn = await rdr_create_icon_conn();

  // This cannot re-use caller's channel because it is called unawaited and the
  // caller's channel may close before this eventually tries to post messages to
  // the channel
  const channel = rdr_create_channel();

  const options = {};
  options.ignore_recency_check = true;
  options.notify = false;

  await rdr_poll_feed(rconn, iconn, channel, console, options, feed);

  channel.close();
  rconn.close();
  iconn.close();
}
