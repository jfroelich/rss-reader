import * as app from '/src/app.js';
import * as favicon from '/src/action/favicon/favicon.js';
import * as array from '/src/lib/array.js';
import assert from '/src/lib/assert.js';
import {fetch_feed} from '/src/lib/net/fetch-feed.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import * as sanity from '/src/model-sanity.js';

// TODO: consider using a single transaction
// TODO: implement unsubscribe wrapper to avoid view directly calling
// delete-feed

// Subscribe to a feed
// @param dal {ModelAccess} an open ModelAccess instance
// @param iconn {IDBDatabase} an open icon database connection
// @param url {URL} the url to subscribe
// @param should_notify {Boolean} whether to send a notification
// @param fetch_timeout {Number} fetch timeout
// @error database errors, type errors, fetch errors, etc
// @return {Promise} resolves to the feed object stored in the database
export async function subscribe(dal, iconn, url, fetch_timeout, should_notify) {
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

  if (!sanity.is_valid_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  if (iconn) {
    const url = favicon.create_lookup_url(feed);
    let doc = undefined;
    const fetch = false;
    feed.faviconURLString = await favicon.lookup(iconn, url, doc, fetch);
  }

  sanity.sanitize_feed(feed);
  await dal.updateFeed(feed);

  if (should_notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || array.peek(feed.urls);
    const message = 'Subscribed to ' + feed_title;
    app.show_notification(title, message, feed.faviconURLString);
  }

  return feed;
}
