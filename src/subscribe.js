import {coerce_feed} from '/src/coerce-feed.js';
import * as db from '/src/db.js';
import * as favicon from '/src/favicon.js';
import {fetch_feed} from '/src/fetch.js';
import {list_peek} from '/src/lib/lang/list.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {notify} from '/src/notify.js';

// Subscribe to a feed
// @param rconn {IDBDatabase} an open feed database connection
// @param iconn {IDBDatabase} an open icon database connection
// @param channel {BroadcastChannel} where to send messages
// @param url {URL} the url to subscribe
// @param notify {Boolean} whether to send a notification
// @param fetch_timeout {Number} fetch timeout
// @param skip_icon_lookup {Boolean}
// @error database errors, type errors, fetch errors, etc
// @return {Promise} resolves to the feed stored in the database
export async function subscribe(
    rconn, iconn, channel, url, fetch_timeout, should_notify = true,
    skip_icon_lookup) {
  if (await feed_exists(rconn, url)) {
    throw new Error('Already subscribed ' + url.href);
  }

  const response = await fetch_feed(url, fetch_timeout);
  if (!response.ok) {
    throw new Error(
        'Fetching ' + url.href + ' failed with status ' + response.status);
  }

  const res_url = new URL(response.url);
  if (url_did_change(url, res_url) && await feed_exists(rconn, res_url)) {
    throw new Error('Already subscribed ' + res_url.href);
  }

  const feed = await get_feed_from_response(response);
  if (!db.is_valid_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  if (!skip_icon_lookup) {
    await set_favicon(iconn, feed);
  }

  db.sanitize_feed(feed);
  await db.update_feed(rconn, channel, feed);

  if (should_notify) {
    show_success_notification(feed);
  }

  return feed;
}

async function get_feed_from_response(response) {
  const skip_entries = true, resolve_urls = false;
  const response_text = await response.text();
  const parsed_feed = parse_feed(response_text, skip_entries, resolve_urls);

  const res_url = new URL(response.url);
  const lmd = new Date(response.headers.get('Last-Modified'));
  const feed = coerce_feed(parsed_feed, {
    request_url: url,
    response_url: res_url,
    response_last_modified_date: lmd.getTime() === NaN ? null : lmd
  });

  return feed;
}

async function set_favicon(conn, feed) {
  const url = favicon.create_lookup_url(feed);
  let doc = undefined;
  const fetch = false;
  feed.faviconURLString = await favicon.lookup(conn, url, doc, fetch);
}

function show_success_notification(feed) {
  const title = 'Subscribed!';
  const feed_title = feed.title || list_peek(feed.urls);
  const message = 'Subscribed to ' + feed_title;
  notify(title, message, feed.faviconURLString);
}

// Returns a promise that resolves to whether a feed with the given url exists
// in the database
function feed_exists(conn, url) {
  const query_mode = 'url';
  const load_key_only = true;
  return db.get_feed(conn, query_mode, url, load_key_only);
}
