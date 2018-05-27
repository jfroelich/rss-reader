import {db_contains_feed} from '/src/db/db-contains-feed.js';
import {db_write_feed} from '/src/db/db-write-feed.js';
import {favicon_create_feed_lookup_url, favicon_lookup} from '/src/favicon.js';
import {append_feed_url, coerce_feed} from '/src/feed.js';
import {fetch_feed} from '/src/fetch.js';
import {list_peek} from '/src/lib/lang/list.js';
import {parse_feed} from '/src/lib/parse-feed.js';
import {url_did_change} from '/src/lib/url-did-change.js';
import {notify} from '/src/notify.js';

// Subscribes the user to a new feed.

// ### Context parameters
// * **rconn** {IDBDatabase} an open database connection to the feed database
// * **iconn** {IDBDatabase} an open database connection to the icon database,
// optional
// * **channel** {BroadcastChannel} a channel that will receive messages such as
// the feed being created within the database
// * **console** {object} a logging destination, any console-like object
// including the builtin console, required, consider using console-stub to call
// non-verbose

// ### Parameters
// * **url** {URL} the url of the feed to subscribe to
// * **options** {object} various options to customize the behavior of the
// subscribe operation, optional

// ### Options
// * **notify** {Boolean} whether to send a notification on successful
// subscription, defaults to false
// * **fetch_timeout** {Number} should be a positive integer, optional, how many
// milliseconds to wait before considering a fetch of the url a failure
// * **skip_icon_lookup** {Boolean} whether to skip the favicon lookup for the
// new feed, defaults to false, useful to speed up the operation

// ### Errors
// * **TypeError** if the input url is not a url
// * **DOMException** any kind of database error
// * **InvalidStateError** if the channel is closed at the time a message is
// posted

// ### Return value
// The `subscribe` function is asynchronous, so it returns a promise. If
// successful, the promise resolves to the feed object that was stored in the
// database. If an error occurred, then the promise rejects. If the feed, or the
// redirected url of the feed, exist in the database, then `subscribe` returns
// undefined (not an error).

// ### TODOs
// * Move these to github issues
// * Reconsider the transaction lifetime. Right now it is protected by the
// error that occurs due to violation of uniqueness constraint. But it would be
// better if both reads and writes occurred on same transaction.
// * I have mixed feelings about treating already-subscribed as an error. It
// isn't a programming error. But the subscribe in some sense failed. Right now
// this returns undefined. But maybe it should be an error. Or maybe I need a
// more complicated type of return value. Just returning undefined does not
// really clarify things. I am not sure callers expect it, and not sure I like
// this approach.
// * Currently the redirect url is not validated as to whether it is a
// fetch-able url according to the app's fetch policy. It is just assumed. I am
// not quite sure what to do about it at the moment. Maybe I could create a
// second policy that controls what urls are allowed by the app to be stored in
// the database? Or maybe I should just call `url_is_allowed` here explicitly?
// This is partly a caveat of attempting to abstract it away behind the call to
// the fetch helper, which checks the policy internally. The issue is that it
// cannot be abstracted away if I need to use it again for non-fetch purposes.

export async function subscribe(url, options) {
  this.console.log('Subscribing to feed', url.href);

  if (await db_contains_feed(this.rconn, {url: url})) {
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
    if (await db_contains_feed(this.rconn, redirect_query)) {
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
    const lookup_url = favicon_create_feed_lookup_url(feed);
    const lookup_op = {
      conn: this.iconn,
      console: this.console,
      favicon_lookup: favicon_lookup
    };
    let lookup_doc = undefined, fetch = false;
    feed.faviconURLString =
        await lookup_op.favicon_lookup(lookup_url, lookup_doc, fetch);
  }

  const write_op = {
    conn: this.rconn,
    channel: this.channel,
    console: this.console,
    db_write_feed: db_write_feed
  };
  const write_options = {
    validate: true,
    sanitize: true,
    set_date_updated: false
  };
  const stored_feed = await write_op.db_write_feed(feed, write_options);

  if (options.notify) {
    const title = 'Subscribed!';
    const feed_title = feed.title || list_peek(stored_feed.urls);
    const message = 'Subscribed to ' + feed_title;
    notify(title, message, stored_feed.faviconURLString);
  }

  return stored_feed;
}
