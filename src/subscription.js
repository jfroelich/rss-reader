// Functions for subscribing to and unsubscribing from feeds
'use strict';

// TODO: if the prefix is sub, then the file should be called sub.js

// Dependencies:
// assert.js
// debug.js
// extension.js
// favicon.js
// feed.js
// fetch-feed.js
// object.js
// parse-fetched-feed.js
// reader-db.js

// Returns a result object with properties status and feed. feed is only defined
// if status === STATUS_OK. feed is a copy of the inserted feed, which
// includes its new id.
async function sub_add(feed, reader_conn, icon_conn, timeout_ms, notify) {
  ASSERT(feed);

  DEBUG('called sub_add with feed', feed);

  // TODO: assert reader_conn and icon_conn are open connections
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 2000;
  if(typeof notify === 'undefined')
    notify = true;

  const url_string = feed_get_top_url(feed);
  ASSERT(url_string);

  let status = await sub_url_is_unique(url_string, reader_conn);
  if(status !== STATUS_OK)
    return {'status' : status};

  // skip the favicon lookup while offline
  // TODO: maybe should not skip if cache-only lookup could still work
  if('onLine' in navigator && !navigator.onLine) {
    return await sub_put_feed(feed, reader_conn, notify);
  }

  let response;
  try {
    response = await fetch_feed(url_string, timeout_ms);
  } catch(error) {
    DEBUG(error);
    return {'status': ERR_FETCH};
  }

  // If fetch_feed did not throw then response should always be defined.
  ASSERT(response);

  if(response.redirected) {
    status = await sub_url_is_unique(response.response_url, reader_conn);
    if(status !== STATUS_OK)
      return {'status' : status};

    // TODO: when and where is redirect url appended to feed's url list?? I am
    // not entirely sure I ever did this. This should be happening. Does it
    // happen within parse_fetched_feed? If not then it should be done right
    // here.
  }

  // Now that we know the redirect does not exist, parse the remainder of the
  // response into a feed object.

  let parse_result;
  try {
    // Must be awaited because internally parse_fetched_feed fetches the body
    // of the response
    parse_result = await parse_fetched_feed(response);
  } catch(error) {
    DEBUG(error);
    return {'status': ERR_PARSE};
  }

  const merged_feed = merge_feeds(feed, parse_result.feed);
  try {
    await feed_update_favicon(merged_feed, icon_conn);
  } catch(error) {
  }

  return await sub_put_feed(merged_feed, reader_conn, notify);
}

// Return the status. Return ok if not already exists
async function sub_url_is_unique(url_string, reader_conn) {
  try {
    if(await reader_db_find_feed_id_by_url(reader_conn, url_string))
      return ERR_DB_OP;
  } catch(error) {
    DEBUG(error);
    return ERR_DB_OP;
  }
  return STATUS_OK;
}

async function sub_put_feed(feed, reader_conn, notify) {
  const storable_feed = sub_feed_prep(feed);
  let new_id;
  try {
    new_id = await reader_db_put_feed(reader_conn, storable_feed);
  } catch(error) {
    DEBUG(error);
    return {'status': ERR_DB_OP};
  }

  storable_feed.id = new_id;
  sub_notify_add(storable_feed, notify);
  return {'status': STATUS_OK, 'feed': storable_feed};
}

function sub_notify_add(feed, notify) {
  'use strict';
  if(!notify) return;
  const title = 'Subscribed';
  const feed_name = feed.title || feed_get_top_url(feed);
  const message = 'Subscribed to ' + feed_name;
  extension_notify(title, message, feed.faviconURLString);
}

// Creates a shallow copy of the input feed suitable for storage
function sub_feed_prep(feed) {
  'use strict';
  let storable = feed_sanitize(feed);
  storable = object_filter_empty_props(storable);
  storable.dateCreated = new Date();
  return storable;
}

// Concurrently subscribe to each feed in the feeds iterable. Returns a promise
// that resolves to an array of subscribed feeds. If a subscription fails due
// to an error, that subscription and all later subscriptions are ignored,
// but earlier ones are committed. If a subscription fails but not for an
// exceptional reason, then it is skipped.
function sub_add_all(feeds, reader_conn, icon_conn, timeout_ms) {
  // TODO: better handling of notifications, maybe a single batch notification
  // For now, no notifications for batch subscriptions
  const notify = false;
  const promises = [];
  for(const feed of feeds) {
    const promise = sub_add(feed, reader_conn, icon_conn, timeout_ms,
      notify);
    promises.push(promise);
  }
  return Promise.all(promises);
}

// Unsubscribes from a feed
// @param conn {IDBDatabase} an open database connection
// @param feed_id {Number} id of feed to unscubscribe
// TODO: return a subscription result object instead of number of entries
async function sub_remove(feed_id, conn) {
  DEBUG('unsub', feed_id);
  ASSERT(feed_is_valid_feed_id(feed_id));

  // TODO: assert conn open. How do I check if an instance of IDBDatabase is
  // open? I am not seeing any details on MDB. Check spec.
  // Looking at spec, it looks like I want !conn.closePending

  // Find all entries for the feed, load the ids into memory, then remove the
  // feed and the entries
  // TODO: look into a deleteAll function that would allow this to skip loading
  // the ids into memory

  let entry_ids;
  try {
    entry_ids = await reader_db_find_entry_ids_by_feed(conn, feed_id);
    await reader_db_remove_feed_and_entries(conn, feed_id, entry_ids);
  } catch(error) {
    DEBUG(error);
    // TODO: return something clearer, right now this is ambiguous as to
    // whether 0 entries removed, or error. But in order to do that I need
    // to change the return value of the whole function, so this requires more
    // thought.
    return 0;
  }

  // TODO: rather than request badge update, maybe it would be better if badge
  // update responded to a broadcasted message about the change in entry store
  // state. Such as an entries-changed event.
  extension_update_badge_text(); // ignore errors

  // To avoid large message size, broadcast individual messages.
  // TODO: rename types to feed_deleted, entry_deleted
  // TODO: would be better to broadcast a single message for entries? but how
  // would slideshow react to entries loaded (by feed actually?)
  const channel = new BroadcastChannel('db');
  channel.postMessage({'type': 'feedDeleted', 'id': feed_id});
  for(const entry_id of entry_ids)
    channel.postMessage({'type': 'entryDeleted', 'id': entry_id});
  channel.close();

  return entry_ids.length;
}
