import {fetch_feed} from '/src/net/fetch-feed/fetch-feed.js';
import * as db from '/src/db/db.js';
import {response_is_redirect} from '/src/net/fetch2.js';
import * as favicon from '/src/favicon/favicon-control.js';
import * as notification from '/src/notification.js';

export async function subscribe(
    session, iconn, url, fetch_timeout, should_notify) {
  if (await model_has_feed_url(session, url)) {
    throw new ConstraintError('Found existing feed with url ' + url.href);
  }

  const feed = await fetch_feed_without_entries(url, fetch_timeout);

  const res_url = new URL(feed.urls[feed.urls.length - 1]);

  // TODO: response_is_redirect now accepts a response object, not a response
  // url. Therefore, this needs to be able to access the response object, so
  // fetch_feed_without_entries needs to expose this. What I should probably
  // do is step backward, and inline the helper again, due to the shifted
  // requirements. In the mean time this extra check is disabled and hopefully
  // does not lead to serious problems.

  // if (response_is_redirect(url, res_url) && await model_has_feed_url(session,
  // res_url)) {
  //  throw new ConstraintError(
  //      'Found existing feed for redirected url ' + res_url.href);
  //}

  await set_feed_favicon(iconn, feed);
  db.validate_feed(feed);
  db.sanitize_feed(feed);
  feed.id = await db.create_feed(session, feed);
  send_subscribe_notification(feed, should_notify);
  return feed;
}

function send_subscribe_notification(feed, should_notify) {
  if (should_notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || feed.urls[feed.urls.length - 1];
    const message = 'Subscribed to ' + feed_title;
    notification.show(title, message, feed.faviconURLString);
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

async function model_has_feed_url(session, url) {
  const key_only = true;
  const feed = await db.get_feed(session, 'url', url, key_only);
  return feed ? true : false;
}

export function unsubscribe(session, feed_id) {
  return db.delete_feed(session, feed_id, 'unsubscribe');
}

export class ConstraintError extends Error {
  constructor(message = 'Violation of storage constraint') {
    super(message);
  }
}
