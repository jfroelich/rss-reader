import * as favicon_service from '/src/favicon-service/favicon-service.js';
import * as feed_parser from '/src/feed-parser/feed-parser.js';
import * as fetchlib from '/src/fetch/fetch.js';
import * as notifications from '/src/notifications/notifications.js';
import {PollService} from '/src/poll-service/poll-service.js';
import {coerce_feed} from '/src/rdb/coerce-feed.js';
import * as rdb from '/src/rdb/rdb.js';

// TODO: create docs

// TODO: reconsider the transaction lifetime. Right now it is protected by the
// error that occurs due to violation of uniqueness constraint. But it would be
// better if both reads and writes occurred on same transaction. Also because I
// have mixed feelings about treating already-subscribed as an error. It isn't a
// programming error. But the subscribe in some sense failed.

// TODO: currently the redirect url is not validated as to whether it is a
// fetchable url according to the app's fetch policy. It is just assumed. I am
// not quite sure what to do about it at the moment. Maybe I could create a
// second policy that controls what urls are allowed by the app to be stored in
// the database? Or maybe I should just call url_is_allowed here explicitly?
// This is partly a caveat of attempting to abstract it away behind the call to
// the fetch helper, which checks the policy internally. The issue is that it
// cannot be abstracted away if I need to use it again for non-fetch purposes.
// So really it is just the wrong abstraction. Move this comment to github

// TODO: rename context properties, deferred for now because it involves
// other modules

// Properties for the context argument:
// feedConn {IDBDatabase} an open conn to feed store
// iconConn {IDBDatabase} an open conn to icon store
// channel {BroadcastChannel} optional, an open channel to which to send feed
// added message
// fetchFeedTimeout {Number} optional, positive integer, how long to wait in ms
// before considering fetch a failure
// notify {Boolean} optional, whether to show a desktop notification
// console {console object} optional, console-like logging destination
export default async function subscribe(context, url) {
  assert(typeof context === 'object');
  assert(context.feedConn instanceof IDBDatabase);
  assert(context.iconConn instanceof IDBDatabase);
  assert(url instanceof URL);

  const console = context.console || NULL_CONSOLE;
  console.log('Subscribing to', url.href);

  // If this fails, throw an error
  let contains_feed = await rdb.contains_feed_with_url(context.feedConn, url);

  // If already subscribed, throw an error
  // TODO: is this really an error? This isn't an error. This just means cannot
  // subscribe, but it isn't exception worthy. Should I return undefined
  // instead? But then how do I know about failure? This is not a programmer
  // error. This is just rejected user input, and users can input whatever they
  // want. Even then, should I use an exception anyway? Ugh.
  if (contains_feed) {
    throw new Error('Already subscribed to ' + url.href);
  }

  let response =
      await fetchlib.fetch_feed(url, context.fetchFeedTimeout || 2000);
  if (!response.ok) {
    if (response.status === fetchlib.STATUS_OFFLINE) {
      // continue with offline subscription
      console.debug('Subscribing while offline to', url.href);
      // nullify so that legacy code following this behaves as before in case of
      // exception where response is left undefined
      response = null;
    } else {
      throw new Error('Failed to fetch ' + url.href);
    }
  }

  let feed;
  if (response instanceof Response) {
    // Allow errors to bubble
    feed = await subscribe_create_feed_from_response(context, response, url);
  } else {
    // Offline subscription
    feed = rdb.feed_create();
    rdb.feed_append_url(feed, url);
  }

  // Set the feed's favicon
  const query = {};
  query.conn = context.iconConn;
  query.skipURLFetch = true;

  await subscribe_feed_set_favicon(query, feed, console);

  const stored_feed =
      await rdb.feed_add(context.feedConn, context.channel, feed);

  const should_notify = 'notify' in context ? context.notify : true;
  if (should_notify) {
    subscribe_notification_show(stored_feed);
  }

  subscribe_feed_poll(stored_feed, context.channel)
      .catch(console.warn);  // non-blocking
  return stored_feed;
}

async function subscribe_create_feed_from_response(context, response, url) {
  const response_url = new URL(response.url);

  // If there was a redirect, then check if subscribed to the redirect
  if (fetchlib.url_did_change(url, response_url)) {
    // Allow database error to bubble uncaught
    const contains_feed =
        await rdb.contains_feed_with_url(context.feedConn, response_url);
    if (contains_feed) {
      throw new Error(
          'Already susbcribed to redirect url ' + response_url.href);
    }
  }

  // Treat any fetch error here as fatal. We are past the point of trying to
  // subscribe while offline. This basically should never throw
  const response_text = await response.text();

  // Parse the feed xml. Parsing errors are intentionally not handled here
  // and rethrown.
  const skip_entries_flag = true;
  const resolve_entry_urls_flag = false;
  const parsed_feed = feed_parser.parse(
      response_text, skip_entries_flag, resolve_entry_urls_flag);

  // Reformat the parsed feed object as a storable feed object, while also
  // introducing fetch information. Treat any coercion error as fatal and allow
  // the error to bubble.
  const coerced_feed = coerce_feed(parsed_feed, {
    request_url: url,
    response_url: response_url,
    response_last_modified_date:
        fetchlib.response_get_last_modified_date(response)
  });
  return coerced_feed;
}

async function subscribe_feed_set_favicon(query, feed, console) {
  assert(rdb.is_feed(feed));

  const favicon_lookup_url = rdb.feed_create_favicon_lookup_url(feed);

  // Suppress lookup errors
  let favicon_url_string;
  try {
    favicon_url_string = await favicon_service.lookup(query);
  } catch (error) {
    console.debug(error);
    return;
  }

  if (favicon_url_string) {
    feed.faviconURLString = favicon_url_string;
  }
}

function subscribe_notification_show(feed) {
  const title = 'Subscribed!';
  const feed_title = feed.title || rdb.feed_peek_url(feed);
  const message = 'Subscribed to ' + feed_title;
  notifications.show(title, message, feed.faviconURLString);
}

async function subscribe_feed_poll(feed, channel) {
  const service = new PollService();
  service.ignore_recency_check = true;
  service.ignore_modified_check = true;
  service.notify = false;
  await service.init(channel);
  await service.poll_feed(feed);
  service.close(/* close_channel */ false);
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

function noop() {}

const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};
