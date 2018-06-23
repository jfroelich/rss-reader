import * as app from '/src/app.js';
import {assert} from '/src/assert.js';
import * as favicon from '/src/favicon/favicon.js';
import * as array from '/src/lang/array.js';
import * as Feed from '/src/model/feed.js';
import {sanitize_feed} from '/src/model/sanitize-feed.js';
import {fetch_feed} from '/src/net/fetch-feed.js';
import {url_did_change} from '/src/net/url-did-change.js';


// Subscribe to a feed. This creates a new feed in the database
// @param dal {ReaderDAL} an open ReaderDAL instance
// @param iconn {IDBDatabase} an open icon database connection
// @param url {URL} the url to subscribe
// @param notify {Boolean} whether to send a notification
// @param fetch_timeout {Number} fetch timeout
// @param skip_icon_lookup {Boolean}
// @error database errors, type errors, fetch errors, etc
// @return {Promise} resolves to the feed object stored in the database
export async function subscribe(
    dal, iconn, url, fetch_timeout, should_notify = true, skip_icon_lookup) {
  const query_mode = 'url';
  const load_key_only = true;
  let existing_feed = await dal.getFeed(query_mode, url, load_key_only);
  if (existing_feed) {
    throw new Error('Already subscribed ' + url.href);
  }

  // Fetch and parse and coerce the remote feed without entries. Rethrow any
  // errors
  const response = await fetch_feed(url, fetch_timeout, true, false);
  const feed = response.feed;
  const res_url = new URL(array.peek(feed.urls));

  if (url_did_change(url, res_url)) {
    existing_feed = await dal.getFeed(query_mode, res_url, load_key_only);
    if (existing_feed) {
      throw new Error('Already subscribed ' + res_url.href);
    }
  }

  if (!Feed.is_valid(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  if (!skip_icon_lookup) {
    const url = favicon.create_lookup_url(feed);
    let doc = undefined;
    const fetch = false;
    feed.faviconURLString = await favicon.lookup(iconn, url, doc, fetch);
  }

  sanitize_feed(feed);
  await dal.updateFeed(feed);

  if (should_notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || array.peek(feed.urls);
    const message = 'Subscribed to ' + feed_title;
    app.show_notification(title, message, feed.faviconURLString);
  }

  return feed;
}
