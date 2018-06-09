import {coerce_feed} from '/src/coerce-feed.js';
import {favicon_create_feed_lookup_url, favicon_lookup} from '/src/favicon.js';
import {fetch_feed} from '/src/fetch.js';
import {list_peek} from '/src/lib/lang/list.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {notify} from '/src/notify.js';
import {get_feed, is_valid_feed, sanitize_feed, update_feed} from '/src/reader-db.js';

// TODO: revert to throwing an exception in any non-success path. This means
// that callers will need to use try/catch. The code is just so ugly now, and
// is unconventional. I am forced into exception syntax.

// Subscribe to a feed
// @context-param rconn {IDBDatabase} an open database connection to the feed
// database
// @context-param iconn {IDBDatabase} an open database connection to the icon
// database for caching favicon lookups, optional
// @context-param channel {BroadcastChannel} an open channel that will receive
// messages such as the feed being created within the database
// @param url {URL} the url of the feed to subscribe
// @param notify {Boolean} whether to send a notification on successful
// subscription, defaults to true
// @param fetch_timeout {Number} should be a positive integer, optional, how
// many milliseconds to wait before considering a fetch of the url a failure
// @param skip_icon_lookup {Boolean} whether to skip the favicon lookup for the
// new feed, default false
// @error {TypeError} if the input url is not a url
// @error {DOMException} database errors
// @error {InvalidStateError} if the channel is closed at the time a message is
// posted
// @return {Promise} if successful, the promise resolves to the feed object that
// was stored in the database. If an error occurred, then the promise rejects.
// If the feed, or the redirected url of the feed, exist in the database, then
// resolves to undefined (not an error).
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
  if (!is_valid_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  if (!skip_icon_lookup) {
    await set_favicon(iconn, feed);
  }

  sanitize_feed(feed);
  await update_feed(rconn, channel, feed);

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
  const lookup_url = favicon_create_feed_lookup_url(feed);
  let lookup_doc = undefined;
  const fetch = false;
  feed.faviconURLString =
      await favicon_lookup(conn, lookup_url, lookup_doc, fetch);
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
  return get_feed(conn, query_mode, url, load_key_only);
}
