import {parse as parse_feed} from '/src/lib/feed-parser.js';
import {list_peek} from '/src/lib/list.js';
import {url_did_change} from '/src/lib/url-loader.js';
import {coerce_feed, feed_append_url, feed_create_favicon_lookup_url} from '/src/objects/feed.js';
import {contains_feed} from '/src/ops/contains-feed.js';
import {create_feed} from '/src/ops/create-feed.js';
import {fetch_feed} from '/src/ops/fetch.js';
import {lookup_icon} from '/src/ops/lookup-icon.js';
import {notify} from '/src/ops/notify.js';

export async function subscribe(url, options) {
  this.console.log('Subscribing to feed', url.href);

  if (await contains_feed(this.rconn, {url: url})) {
    this.console.debug('url exists', url.href);
    return;
  }

  const response = await fetch_feed(url, options.fetch_timeout);
  if (!response.ok) {
    this.console.debug(
        '%s: fetch error', subscribe.name, url.href, response.status);
    return;
  }

  const response_url = new URL(response.url);
  if (url_did_change(url, response_url)) {
    const redirect_query = {url: response_url};
    if (await contains_feed(this.rconn, redirect_query)) {
      this.console.debug(
          '%s: redirect url exists', subscribe.name, url.href,
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
    this.console.debug('%s: parse error', subscribe.name, response.url, error);
    return;
  }

  const lmd = new Date(response.headers.get('Last-Modified'));
  const feed = coerce_feed(parsed_feed, {
    request_url: url,
    response_url: response_url,
    response_last_modified_date: lmd.getTime() === NaN ? null : lmd
  });

  if (!options.skip_icon_lookup) {
    const lookup_url = feed_create_favicon_lookup_url(feed);
    const lio = {conn: this.iconn, console: this.console, lookup: lookup_icon};
    let lookup_doc = undefined, fetch = false;
    feed.faviconURLString = await lio.lookup(lookup_url, lookup_doc, fetch);
  }

  const create_op = {
    conn: this.rconn,
    channel: this.channel,
    console: this.console,
    create_feed: create_feed
  };
  const sanitize_feed = true;
  const stored_feed = await create_op.create_feed(feed, sanitize_feed);

  if (options.notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || list_peek(stored_feed.urls);
    const message = 'Subscribed to ' + feed_title;
    notify(title, message, stored_feed.faviconURLString);
  }

  return stored_feed;
}
