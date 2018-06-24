import * as app from '/src/app.js';
import {assert} from '/src/assert.js';
import * as favicon from '/src/favicon/favicon.js';
import * as array from '/src/lang/array.js';
import * as Feed from '/src/model/feed.js';
import {is_valid_feed, sanitize_feed} from '/src/model/sanity.js';
import {fetch_feed} from '/src/net/fetch-feed.js';
import {url_did_change} from '/src/net/url-did-change.js';

// TODO: skip_icon_lookup is superfluous, iconn can be optional and that is
// enough to discern intent
// TODO: look into using a single transaction
// TODO: implement unsubscribe wrapper and avoid view directly calling
// delete-feed

// Subscribe to a feed
// @param dal {ReaderDAL} an open ReaderDAL instance
// @param iconn {IDBDatabase} an open icon database connection
// @param url {URL} the url to subscribe
// @param should_notify {Boolean} whether to send a notification
// @param fetch_timeout {Number} fetch timeout
// @param skip_icon_lookup {Boolean}
// @error database errors, type errors, fetch errors, etc
// @return {Promise} resolves to the feed object stored in the database
export async function subscribe(
    dal, iconn, url, fetch_timeout, should_notify = true, skip_icon_lookup) {
  let existing_feed = await dal.getFeed('url', url, true);
  if (existing_feed) {
    throw new Error('Already subscribed ' + url.href);
  }

  // Fetch and parse and coerce the remote feed without entries. Rethrow any
  // errors
  const response = await fetch_feed(url, fetch_timeout, true, false);
  const feed = response.feed;
  const res_url = new URL(array.peek(feed.urls));

  if (url_did_change(url, res_url)) {
    existing_feed = await dal.getFeed('url', res_url, true);
    if (existing_feed) {
      throw new Error('Already subscribed ' + res_url.href);
    }
  }

  if (!is_valid_feed(feed)) {
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
