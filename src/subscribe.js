import {favicon_create_feed_lookup_url, favicon_lookup} from '/src/favicon.js';
import {coerce_feed} from '/src/feed.js';
import {fetch_feed} from '/src/fetch.js';
import {list_peek} from '/src/lib/lang/list.js';
import {url_did_change} from '/src/lib/net/url-did-change.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {log} from '/src/log.js';
import {notify} from '/src/notify.js';
import {get_feed, sanitize_feed, update_feed, is_valid_feed} from '/src/reader-db.js';



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
export async function subscribe(url, options) {
  log('Subscribing to feed', url.href);

  // TODO: create a local helper that wraps this call and takes a conn and url
  // parameter, use it for both cases

  let prior_feed = await get_feed(this.rconn, 'url', url, true);

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
    prior_feed = await get_feed(this.rconn, 'url', response_url, true);

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

  if (!is_valid_feed(feed)) {
    throw new Error('Invalid feed ' + JSON.stringify(feed));
  }

  sanitize_feed(feed);
  await update_feed(this.rconn, this.channel, feed);

  if (options.notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || list_peek(feed.urls);
    const message = 'Subscribed to ' + feed_title;
    notify(title, message, feed.faviconURLString);
  }

  return feed;
}
