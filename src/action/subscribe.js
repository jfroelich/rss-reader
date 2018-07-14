import * as favicon from '/src/action/favicon/favicon.js';
import * as app from '/src/app.js';
import * as array from '/src/lib/array.js';
import {fetch_feed} from '/src/lib/net/fetch-feed.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import * as sanity from '/src/model/model-sanity.js';

// Subscribe to a feed.  Entries are excluded because it takes too long to
// process them on initial subscribe.
// @param ma {ModelAccess} an open ModelAccess instance
// @param iconn {IDBDatabase} an open icon database connection
// @param url {URL} the url to subscribe
// @param should_notify {Boolean} whether to send a notification
// @param fetch_timeout {Number} fetch timeout
// @error database errors, type errors, fetch errors, etc
// @return {Promise} resolves to the feed object stored in the database
export async function subscribe(ma, iconn, url, fetch_timeout, should_notify) {
  if (await model_has_feed_url(ma, url)) {
    throw new ConstraintError('Found existing feed with url ' + url.href);
  }

  const feed = await fetch_feed_without_entries(url, fetch_timeout);

  const res_url = new URL(array.peek(feed.urls));
  if (url_did_change(url, res_url) && await model_has_feed_url(ma, res_url)) {
    throw new ConstraintError(
        'Found existing feed for redirected url ' + res_url.href);
  }

  await set_feed_favicon(iconn, feed);
  sanity.validate_feed(feed);
  sanity.sanitize_feed(feed);
  feed.id = await ma.createFeed(feed);
  send_subscribe_notification(feed, should_notify);
  return feed;
}

function send_subscribe_notification(feed, should_notify) {
  if (should_notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || array.peek(feed.urls);
    const message = 'Subscribed to ' + feed_title;
    app.show_notification(title, message, feed.faviconURLString);
  }
}

async function set_feed_favicon(iconn, feed) {
  if (!iconn) {
    return;
  }

  const lookup_url = favicon.create_lookup_url(feed);
  let prefetched_document = undefined;
  const do_fetch_during_lookup = false;
  feed.faviconURLString = await favicon.lookup(
      iconn, lookup_url, prefetched_document, do_fetch_during_lookup);
}

async function fetch_feed_without_entries(url, timeout) {
  const skip_entries = true;
  const resolve_entry_urls = false;
  const response =
      await fetch_feed(url, timeout, skip_entries, resolve_entry_urls);
  return response.feed;
}

async function model_has_feed_url(ma, url) {
  const key_only = true;
  const feed = await ma.getFeed('url', url, key_only);
  return feed ? true : false;
}

export function unsubscribe(ma, feed_id) {
  return ma.deleteFeed(feed_id, 'unsubscribe');
}

export class ConstraintError extends Error {
  constructor(message = 'Violation of storage constraint') {
    super(message);
  }
}
