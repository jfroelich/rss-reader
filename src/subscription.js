
// Direct dependencies:
// assert.js
// debug.js
// extension.js
// favicon.js
// feed.js
// fetch-feed.js
// object.js
// parse-fetched-feed.js
// reader-db.js

const subscription = {};

subscription._status_counter = 0;

// TODO: i think if I want to be able to simply forward errors up the chain,
// akin to exceptions, I need to put them all into the status.js global list

subscription.OK = subscription._status_counter++;
subscription.ERR_DB = subscription._status_counter++;
subscription.ERR_UNIQUE = subscription._status_counter++;
subscription.ERR_FETCH = subscription._status_counter++;
subscription.ERR_PARSE = subscription._status_counter++;

// Returns the feed that was added if successful. Otherwise returns undefined.
// Only throws unexpected errors.
// TODO: return a subscription_result object instead, that contains an error
// code and the feed (if no error). This will allow to differentiate between
// outcomes of calling the function (between various errors)
subscription.add = async function(feed, reader_conn, icon_conn, timeout_ms,
  notify) {
  'use strict';
  DEBUG('subscription_create', feed);
  // TODO: assert reader_conn and icon_conn are open connections
  ASSERT(feed);

  if(typeof timeout_ms === 'undefined')
    timeout_ms = 2000;
  if(typeof notify === 'undefined')
    notify = true;

  const url_string = feed_get_top_url(feed);
  ASSERT(url_string);

  // Check if we are already subscribed to the input url
  let subscribed = false;
  try {
    subscribed = await reader_db.contains_feed_url(reader_conn, url_string);
  } catch(error) {
    DEBUG(error);
    return {'status': subscription.ERR_DB};
  }

  if(subscribed) {
    DEBUG('already subscribed to feed', url_string);
    return {'status': subscription.ERR_UNIQUE};
  }

  let new_id = 0;

  // Check if we are offline
  if('onLine' in navigator && !navigator.onLine) {
    DEBUG('offline subscription', url_string);

    // skip the favicon lookup while offline
    // TODO: maybe should not skip if cache-only lookup could still work

    // TODO: the db exists call and the db put call technically should belong
    // to the same transaction? Like an insert if not exists single call.
    // Which happens with the implicit unique requirement if I want to defer
    // to indexedDB built in functionality. However, the lookup also reduces
    // later work. Unsure of how to proceed. Maybe redundancy is good.

    const storable_feed = subscription._feed_prep_put(feed);
    try {
      new_id = await reader_db.put_feed(reader_conn, storable_feed);
    } catch(error) {
      DEBUG(error);
      return {'status': subscription.ERR_DB};
    }

    storable_feed.id = new_id;
    subscription._sub_notify(storable_feed, notify);
    return {'status': subscription.OK, 'feed': storable_feed};
  }

  // We are online and know we are not subscribed to the input url. Fetch.
  let response;
  try {
    response = await fetch_feed(url_string, timeout_ms);
  } catch(error) {
    DEBUG(error);
    return {'status': subscription.ERR_FETCH};
  }

  // If fetch_feed did not throw then response should always be defined.
  // NOTE: this may not be the case if I later modify fetch_feed to return
  // undefined instead of throw in the usual case. If that is later changed I
  // need to remember to change this to check if response is defined
  ASSERT(response);

  if(response.redirected) {
    try {
      subscribed = await reader_db.contains_feed_url(reader_conn,
        response.responseURLString);
    } catch(error) {
      DEBUG(error);
      return {'status': subscription.ERR_DB};
    }

    if(subscribed) {
      DEBUG('already subscribed to redirect', response.responseURLString);
      return {'status': subscription.ERR_UNIQUE};
    }

    // TODO: when and where is redirect url appended to feed's url list?? I am
    // not entirely sure I ever did this. This should be happening. Does it
    // happen within parse_fetched_feed? If not then it should be done right
    // here.
  }

  let parse_result;
  try {
    parse_result = parse_fetched_feed(response);
  } catch(error) {
    DEBUG(error);
    return {'status': subscription.ERR_PARSE};
  }

  const remote_feed = parse_result.feed;
  const merged_feed = merge_feeds(feed, remote_feed);

  // TODO: change feed_update_favicon to not throw an error so that this
  // try/catch is not needed
  try {
    await feed_update_favicon(merged_feed, icon_conn);
  } catch(error) {
    // non-fatal
  }

  const storable_feed = subscription._feed_prep_put(merged_feed);
  try {
    new_id = await reader_db.put_feed(reader_conn, storable_feed);
  } catch(error) {
    DEBUG(error);
    return {'status': subscription.ERR_DB};
  }

  storable_feed.id = new_id;
  subscription._sub_notify(storable_feed, notify);
  return {'status': subscription.OK, 'feed': storable_feed};
};

subscription._sub_notify = function(feed, notify) {
  'use strict';
  if(!notify) return;
  const title = 'Subscribed';
  const feed_name = feed.title || feed_get_top_url(feed);
  const message = 'Subscribed to ' + feed_name;
  extension_notify(title, message, feed.faviconURLString);
};

// Creates a shallow copy of the input feed suitable for storage
subscription._feed_prep_put = function(feed) {
  'use strict';
  let storable = feed_sanitize(feed);
  storable = object_filter_empty_props(storable);
  storable.dateCreated = new Date();
  return storable;
};

// Concurrently subscribe to each feed in the feeds iterable. Returns a promise
// that resolves to an array of subscribed feeds. If a subscription fails due
// to an error, that subscription and all later subscriptions are ignored,
// but earlier ones are committed. If a subscription fails but not for an
// exceptional reason, then it is skipped.
subscription.add_all = function(feeds, reader_conn, icon_conn, timeout_ms) {
  'use strict';

  // TODO: better handling of notifications, maybe a single batch notification
  // For now, no notifications for batch subscriptions
  const notify = false;
  const promises = [];
  for(const feed of feeds) {
    const promise = subscription.add(feed, reader_conn, icon_conn, timeout_ms,
      notify);
    promises.push(promise);
  }
  return Promise.all(promises);
};

// Unsubscribes from a feed
// @param conn {IDBDatabase} an open database connection
// @param feed_id {Number} id of feed to unscubscribe
// TODO: return a subscription result object instead of number of entries
subscription.remove = async function(feed_id, conn) {
  'use strict';
  DEBUG('unsub', feed_id);
  ASSERT(feed_is_valid_feed_id(feed_id));

  // TODO: assert conn open. How do I check if an instance of IDBDatabase is
  // open? I am not seeing any details on MDB. Check spec.
  // Looking at spec, it looks like I want !conn.closePending

  let entry_ids;
  try {
    entry_ids = await reader_db.find_entry_ids_for_feed(conn, feed_id);
    await reader_db.remove_feed_and_entries(conn, feed_id, entry_ids);
  } catch(error) {
    DEBUG(error);
    // TODO: return something clearer, right now this is ambiguous as to
    // whether 0 entries removed, or error.
    return 0;
  }

  // non-fatal
  extension_update_badge_text();

  // To avoid large message size, broadcast individual messages.
  // TODO: rename types to feed_deleted, entry_deleted
  const channel = new BroadcastChannel('db');
  channel.postMessage({'type': 'feedDeleted', 'id': feed_id});
  for(const entry_id of entry_ids)
    channel.postMessage({'type': 'entryDeleted', 'id': entry_id});
  channel.close();

  return entry_ids.length;
};
