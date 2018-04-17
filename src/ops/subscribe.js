import {console_stub} from '/src/lib/console-stub/console-stub.js';
import * as feed_parser from '/src/lib/feed-parser/feed-parser.js';
import {list_peek} from '/src/lib/list/list.js';
import * as url_loader from '/src/lib/url-loader/url-loader.js';
import {coerce_feed, feed_append_url, feed_create, feed_create_favicon_lookup_url, is_feed} from '/src/objects/feed.js';
import {contains_feed} from '/src/ops/contains-feed.js';
import {create_channel} from '/src/ops/create-channel.js';
import {create_conn} from '/src/ops/create-conn.js';
import {create_feed} from '/src/ops/create-feed.js';
import {create_icon_conn} from '/src/ops/create-icon-conn.js';
import {fetch_feed} from '/src/ops/fetch-feed.js';
import {lookup_icon} from '/src/ops/lookup-icon.js';
import {notify} from '/src/ops/notify.js';
import {poll_feed} from '/src/ops/poll-feed.js';

export async function subscribe(url, options) {
  console.log('Subscribing to feed', url.href);

  const rconn = this.rconn;
  const iconn = this.iconn;
  const channel = this.channel;
  const console = this.console || console_stub;
  const fetch_timeout = options.fetch_timeout || 2000;
  const notify_flag = options.notify;

  let does_feed_exist = await contains_feed(rconn, {url: url});
  if (does_feed_exist) {
    console.debug('url exists', url.href);
    return;
  }

  const response = await fetch_feed(url, fetch_timeout);
  if (!response.ok) {
    console.debug('Fetch error', url.href, response.status);
    return;
  }

  const response_url = new URL(response.url);

  // If redirected, check if the redirect url exists
  if (url_loader.url_did_change(url, response_url)) {
    does_feed_exist = await contains_feed(rconn, {url: response_url});
    if (does_feed_exist) {
      console.debug('redirect url exists', url.href, response_url.href);
      return;
    }
  }

  const parsed_feed = await parse_response_body(response, console);
  if (!parsed_feed) {
    return;
  }

  // Convert from parsed feed format to storage feed format
  const lmd = new Date(response.headers.get('Last-Modified'));
  const feed = coerce_feed(parsed_feed, {
    request_url: url,
    response_url: response_url,
    response_last_modified_date: lmd.getTime() === NaN ? null : lmd
  });

  // Set the feed's favicon url
  const lookup_url = feed_create_favicon_lookup_url(feed);
  const lio = {conn: iconn, console: console, lookup: lookup_icon};
  let lookup_doc = undefined, fetch = false;
  feed.faviconURLString = lio.lookup(lookup_url, lookup_doc, fetch);

  // Store the feed within the database
  const cfo = {
    conn: rconn,
    channel: channel,
    console: console,
    create_feed: create_feed
  };
  const stored_feed = await cfo.create_feed(feed, /* sanitize*/ true);

  if (notify_flag) {
    const title = 'Subscribed!';
    const feed_title = feed.title || list_peek(stored_feed.urls);
    const message = 'Subscribed to ' + feed_title;
    notify(title, message, stored_feed.faviconURLString);
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
  const rconn = await create_conn();
  const iconn = await create_icon_conn();

  // This cannot re-use caller's channel because it is called unawaited and the
  // caller's channel may close before this eventually tries to post messages to
  // the channel
  const channel = create_channel();

  const options = {};
  options.ignore_recency_check = true;
  options.notify = false;

  await poll_feed(rconn, iconn, channel, console, options, feed);

  channel.close();
  rconn.close();
  iconn.close();
}
