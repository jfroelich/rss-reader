import * as desknote from '/src/control/desknote.js';
import {fetch_feed} from '/src/control/fetch-feed.js';
import {assert} from '/src/lib/assert.js';
import * as favicon from '/src/lib/favicon.js';
import * as net from '/src/lib/net.js';
import {Feed} from '/src/model/feed.js';
import {Model} from '/src/model/model.js';
import * as op_utils from '/src/ops/op-utils.js';

export async function subscribe(session, iconn, url, timeout, notify) {
  assert(session instanceof Model);
  assert(iconn === undefined || iconn instanceof IDBDatabase);
  assert(url instanceof URL);

  // Check if already subscribed
  let existing_feed = await session.getFeed('url', url, true);
  if (existing_feed) {
    const message = 'Found existing feed with url ' + url.href;
    throw new ConstraintError(message);
  }

  // Propagate fetch errors as subscribe errors by not catching
  const response = await fetch_feed(url, timeout);
  const http_response = response.http_response;

  // If redirected, check if subscribed to the redirected url
  if (net.is_redirect(url, http_response)) {
    const rurl = new URL(http_response.url);
    let existing_feed = await session.getFeed('url', rurl, true);
    if (existing_feed) {
      const message = 'Found existing feed with redirect url ' + rurl.href;
      throw new ConstraintError(message);
    }
  }

  const feed = response.feed;
  await set_feed_favicon(feed, iconn);

  Feed.validate(feed);
  Feed.sanitize(feed);
  feed.id = await session.createFeed(feed);

  if (notify) {
    // TODO: use Feed.getURLString
    const feed_title = feed.title || feed.urls[feed.urls.length - 1];
    const note = {};
    note.title = 'Subscribed!';
    note.message = 'Subscribed to ' + feed_title;
    note.url = feed.faviconURLString;
    desknote.show(note);
  }

  return feed;
}

async function set_feed_favicon(feed, iconn) {
  if (!iconn) {
    return;
  }

  const lookup_url = op_utils.get_feed_favicon_lookup_url(feed);
  const request = new favicon.LookupRequest();
  request.url = lookup_url;
  const icon_url = await favicon.lookup(request);
  feed.faviconURLString = icon_url ? icon_url.href : undefined;
}

export class ConstraintError extends Error {
  constructor(message) {
    super(message);
  }
}
