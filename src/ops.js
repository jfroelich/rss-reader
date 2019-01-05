import {fetch_feed} from '/src/net/fetch-feed/fetch-feed.js';
import * as db from '/src/db/db.js';
import {response_is_redirect} from '/src/net/fetch2.js';
import * as favicon from '/src/favicon/favicon-control.js';
import * as notification from '/src/notification.js';

// The ops module represents a middle-layer that is above the database but
// below the view layer. The operations here generally are functions that
// involve the database plus some non-database functionality, such as any
// logic.

// TODO: all higher layers should be interacting with this module instead of
// interacting with the database. This should have all the various ops
// available, even if some of those are just simple db wrapper calls.


export async function subscribe(session, iconn, url, fetch_timeout,
  should_notify) {

  // Check if subscribed to the input url
  let existing_feed = await db.get_feed(session, 'url', url, true);
  if (existing_feed) {
    const message = 'Found existing feed with url ' + url.href;
    throw new ConstraintError(message);
  }

  // TODO: notice the awkwardness here with response vs http response. I think
  // fetch_feed might be a bad abstraction. I think maybe what should happen
  // is that fetch_feed be broken up into consistuent parts fetch_xml and
  // parse_feed_from_xml

  // Propagate fetch errors as subscribe errors
  const response = await fetch_feed(url, timeout, true, false);
  const http_response = response.http_response;

  // If redirected, check if subscribed to the redirected url
  if(response_is_redirect(url, http_response)) {
    const rurl = new URL(http_response.url);
    let existing_feed = await db.get_feed(session, 'url', rurl, true);
    if (existing_feed) {
      const message = 'Found existing feed with redirect url ' + rurl.href;
      throw new ConstraintError(message);
    }
  }

  const feed = response.feed;
  await set_feed_favicon(iconn, feed);
  db.validate_feed(feed);
  db.sanitize_feed(feed);
  feed.id = await db.create_feed(session, feed);

  if(should_notify) {
    const feed_title = feed.title || feed.urls[feed.urls.length - 1];

    // TODO: now I think notification.show should accept a composed parameter
    // object, instead of individual params. In this case the composition is
    // reasonable because the individual parameters are highly related
    const note = {};
    note.title = 'Subscribed!';
    note.message = 'Subscribed to ' + feed_title;
    note.url = feed.faviconURLString;
    notification.show(note.title, note.message, note.url);
  }

  return feed;
}

export function unsubscribe(session, feed_id) {
  return db.delete_feed(session, feed_id, 'unsubscribe');
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

export class ConstraintError extends Error {
  constructor(message = 'Violation of storage constraint') {
    super(message);
  }
}
