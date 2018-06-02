import {db_find_feed_by_url} from '/src/db/db-find-feed-by-url.js';
import {db_sanitize_feed} from '/src/db/db-sanitize-feed.js';
import {db_validate_feed} from '/src/db/db-validate-feed.js';
import {db_write_feed} from '/src/db/db-write-feed.js';
import {favicon_create_feed_lookup_url, favicon_lookup} from '/src/favicon.js';
import {coerce_feed} from '/src/feed.js';
import {fetch_feed} from '/src/fetch.js';
import {list_peek} from '/src/lib/lang/list.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {log} from '/src/log.js';
import {notify} from '/src/notify.js';

// Subscribe to a feed
// @context-param rconn {IDBDatabase} an open database connection to the feed
// database
// @context-param iconn {IDBDatabase} an open database connection to the icon
// database for caching favicon lookups, optional
// @context-param channel {BroadcastChannel} an open channel that will receive
// messages such as the feed being created within the database
// @param url {URL} the url of the feed to subscribe
// @param options {object} various options to customize the behavior of the
// subscribe operation, optional
// @option notify {Boolean} whether to send a notification on successful
// subscription, defaults to false
// @option fetch_timeout {Number} should be a positive integer, optional, how
// many milliseconds to wait before considering a fetch of the url a failure
// @option skip_icon_lookup {Boolean} whether to skip the favicon lookup for the
// new feed, default false
// @error {TypeError} if the input url is not a url
// @error {DOMException} database errors
// @error {InvalidStateError} if the channel is closed at the time a message is
// posted
// @return {Promise} if successful, the promise resolves to the feed object that
// was stored in the database. If an error occurred, then the promise rejects.
// If the feed, or the redirected url of the feed, exist in the database, then
// resolves to undefined (not an error).

// TODO: Reconsider the transaction lifetime. Right now it is protected by the
// error that occurs due to violation of uniqueness constraint. But it would be
// better if both reads and writes occurred on same transaction.
// TODO: I have mixed feelings about treating already-subscribed as an error. It
// isn't a programming error. But the subscribe in some sense failed. Right now
// this returns undefined. But maybe it should be an error. Or maybe I need a
// more complicated type of return value. Returning undefined is unclear.
// TODO: Currently the redirect url is not validated as to whether it is a
// fetch-able url according to the app's fetch policy. It is just assumed. I am
// not quite sure what to do about it at the moment. Maybe I could create a
// second policy that controls what urls are allowed by the app to be stored in
// the database? Or maybe I should just call `url_is_allowed` here explicitly?
// This is partly a caveat of attempting to abstract it away behind the call to
// the fetch helper, which checks the policy internally. The issue is that it
// cannot be abstracted away if I need to use it again for non-fetch purposes.

export async function subscribe(url, options) {
  log('Subscribing to feed', url.href);

  const key_only = true;
  let prior_feed = await db_find_feed_by_url(this.rconn, url, key_only);

  if (prior_feed) {
    log('%s: url exists', subscribe.name, url.href);
    return;
  }

  const response = await fetch_feed(url, options.fetch_timeout);
  if (!response.ok) {
    log('%s: fetch error', subscribe.name, url.href, response.status);
    return;
  }

  const response_url = new URL(response.url);
  if (url_did_change(url, response_url)) {
    prior_feed = await db_find_feed_by_url(this.rconn, response_url, key_only);

    if (prior_feed) {
      log('%s: redirect url exists', subscribe.name, url.href,
          response_url.href);
      return;
    }
  }

  const skip_entries = true, resolve_urls = false;
  const response_text = await response.text();
  let parsed_feed;
  try {
    parsed_feed = parse_feed(response_text, skip_entries, resolve_urls);
  } catch (error) {
    log('%s: parse error', subscribe.name, response.url, error);
    return;
  }

  const lmd = new Date(response.headers.get('Last-Modified'));
  const feed = coerce_feed(parsed_feed, {
    request_url: url,
    response_url: response_url,
    response_last_modified_date: lmd.getTime() === NaN ? null : lmd
  });

  if (!options.skip_icon_lookup) {
    const lookup_url = favicon_create_feed_lookup_url(feed);
    const lookup_op = {conn: this.iconn, favicon_lookup: favicon_lookup};
    let lookup_doc = undefined, fetch = false;
    feed.faviconURLString =
        await lookup_op.favicon_lookup(lookup_url, lookup_doc, fetch);
  }

  if (!db_validate_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  db_sanitize_feed(feed);

  const write_op = {
    conn: this.rconn,
    channel: this.channel,
    db_write_feed: db_write_feed
  };

  // We are creating a new feed, so there is no need to set dateUpdated, in
  // fact it is preferred that it is not set (it will be deleted)

  const stored_feed = await write_op.db_write_feed(feed);

  if (options.notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || list_peek(stored_feed.urls);
    const message = 'Subscribed to ' + feed_title;
    notify(title, message, stored_feed.faviconURLString);
  }

  return stored_feed;
}
