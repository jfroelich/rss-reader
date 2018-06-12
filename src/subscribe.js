import * as db from '/src/db.js';
import * as favicon from '/src/favicon.js';
import {fetch_feed} from '/src/fetch-feed.js';
import * as array from '/src/lib/lang/array.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
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

  // Fetch and parse and coerce the remote feed without entries. Rethrow any
  // errors
  const response = await fetch_feed(url, fetch_timeout, true, false);
  const feed = response.feed;

  // Detect if a redirect occurred based on whether the feed has multiple urls.
  // Having multiple urls does not indicate a redirect. The algorithm for
  // appending urls that happens within fetch_feed avoids duplicates but is
  // otherwise ignorant of redirection concerns. So we still need to do the
  // extended check. If a redirect occurred, then check if the redirect url
  // exists in the database. If the database query fails then throw an error.
  // If the redirect url exists then throw an error.
  if (feed.urls.length > 1) {
    const res_url = new URL(array.peek(feed.urls));
    if (url_did_change(url, res_url) && await feed_exists(rconn, res_url)) {
      throw new Error('Already subscribed ' + res_url.href);
    }
  }

  if (!skip_icon_lookup) {
    await set_feed_favicon(iconn, feed);
  }

  // Validate and sanitize the feed's properties prior to storage
  if (!db.is_valid_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  db.sanitize_feed(feed);
  await db.update_feed(rconn, channel, feed);

  if (should_notify) {
    show_success_notification(feed);
  }

  return feed;
}


async function set_feed_favicon(conn, feed) {
  const url = favicon.create_lookup_url(feed);
  let doc = undefined;
  const fetch = false;
  feed.faviconURLString = await favicon.lookup(conn, url, doc, fetch);
}

function show_success_notification(feed) {
  const title = 'Subscribed!';
  const feed_title = feed.title || array.peek(feed.urls);
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
