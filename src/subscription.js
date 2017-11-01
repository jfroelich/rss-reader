'use strict';

// import base/object.js
// import net/fetch.js
// import feed-coerce-from-response.js
// import feed.js
// import extension.js
// import favicon.js
// import reader-db.js
// import reader-badge.js

function subscription_context() {
  this.reader_conn;
  this.icon_conn;
  this.timeout_ms = 2000;
  this.notify = true;
}

// Returns a result object with properties status and feed. feed is only defined
// if status is ok. feed is a copy of the inserted feed, which includes its new
// id.
async function subscription_add(feed) {
  console.log('subscription_add', feed);
  console.assert(this instanceof subscription_context);
  console.assert(indexeddb_is_open(this.reader_conn));
  console.assert(indexeddb_is_open(this.icon_conn));
  console.assert(feed_is_feed(feed));

  if(!feed_has_url(feed)) {
    return {'status' : RDR_EINVAL};
  }

  const url_string = feed_get_top_url(feed);
  let status = await subscription_unique(url_string, this.reader_conn);
  if(status !== RDR_OK) {
    return {'status' : status};
  }

  // If offline then skip fetching information.
  // TODO: maybe should not support subscribe while offline if I have no way
  // of removing dead or invalid feeds yet

  // Skip the favicon lookup while offline
  // TODO: maybe should not skip favicon lookup if cache-only lookup could
  // still work

  if('onLine' in navigator && !navigator.onLine) {
    return await subscription_put_feed(feed, this.reader_conn, this.notify);
  }

  let response;
  try {
    response = await fetch_feed(url_string, this.timeout_ms);
  } catch(error) {
    // If we are online and fetch fails then cancel the subscription
    console.warn(error);
    return {'status': RDR_ERR_FETCH};
  }

  if(response.redirected) {
    status = await subscription_unique(response.response_url, this.reader_conn);
    if(status !== RDR_OK) {
      return {'status' : status};
    }
  }

  let feed_xml;
  try {
    feed_xml = await response.text();
  } catch(error) {
    console.warn(error);
    return RDR_ERR_FETCH;
  }

  const process_entries = false;
  const parse_result = reader_parse_feed(feed_xml, response.request_url,
    response.response_url, response.last_modified_date, process_entries);
  if(parse_result.status !== RDR_OK) {
    return {'status': parse_result.status};
  }

  const merged_feed = feed_merge(feed, parse_result.feed);
  status = await feed_update_favicon(merged_feed, this.icon_conn);
  if(status !== RDR_OK) {
    console.debug('failed to update feed favicon (non-fatal)', status);
  }

  return await subscription_put_feed(merged_feed, this.reader_conn,
    this.notify);
}

// Check whether a feed with the given url already exists in the database
// Return the status. Return ok if not already exists. Otherwise, returns either
// database error or constraint error.
async function subscription_unique(url_string, reader_conn) {
  let feed;
  try {
    feed = await reader_db_find_feed_id_by_url(reader_conn, url_string);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }
  return feed ? RDR_ERR_CONSTRAINT : RDR_OK;
}

// TODO: this should delegate to reader_storage_put_feed instead
// and subscription_feed_prep should be deprecated as well
// I think first step would be to inline this function, because right now it
// composes prep, store, and notify together.
// The second problem is the notify flag. Basically, let the caller decide
// whether to notify simply by choosing to call subscription_notify_add or not.
// The notify flag is pointless here and also in subscription_notify_add
async function subscription_put_feed(feed, reader_conn, notify) {
  const storable_feed = subscription_feed_prep(feed);
  let new_id;
  try {
    new_id = await reader_db_put_feed(reader_conn, storable_feed);
  } catch(error) {
    console.warn(error);
    return {'status': RDR_ERR_DB};
  }

  storable_feed.id = new_id;
  if(notify) {
    subscription_notify_add(storable_feed);
  }

  return {'status': RDR_OK, 'feed': storable_feed};
}

function subscription_notify_add(feed) {
  const title = 'Subscribed';
  const feed_name = feed.title || feed_get_top_url(feed);
  const message = 'Subscribed to ' + feed_name;
  extension_notify(title, message, feed.faviconURLString);
}

// Creates a shallow copy of the input feed suitable for storage
function subscription_feed_prep(feed) {
  let storable = feed_sanitize(feed);
  storable = object_filter_empty_props(storable);
  storable.dateCreated = new Date();
  return storable;
}

// Concurrently subscribe to each feed in the feeds iterable. Returns a promise
// that resolves to an array of statuses. If a subscription fails due
// to an error, that subscription and all later subscriptions are ignored,
// but earlier ones are committed. If a subscription fails but not for an
// exceptional reason, then it is skipped.
function subscription_add_all(feeds) {
  return Promise.all(feeds.map(subscription_add, this));
}

async function subscription_remove(feed) {
  console.assert(this instanceof subscription_context);
  console.assert(indexeddb_is_open(this.reader_conn));
  console.assert(feed_is_feed(feed));
  console.assert(feed_is_valid_feed_id(feed.id));

  console.log('subscription_remove id', feed.id);

  let entry_ids;
  try {
    entry_ids = await reader_db_find_entry_ids_by_feed(this.reader_conn,
      feed.id);
    await reader_db_remove_feed_and_entries(this.reader_conn, feed.id,
      entry_ids);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  // ignore status
  await reader_update_badge(this.reader_conn);

  const channel = new BroadcastChannel('db');
  channel.postMessage({'type': 'feed-deleted', 'id': feed.id});
  for(const entry_id of entry_ids) {
    channel.postMessage({'type': 'entry-deleted', 'id': entry_id});
  }
  channel.close();

  console.debug('unsubscribed from feed', feed.id);
  return RDR_OK;
}
