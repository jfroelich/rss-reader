'use strict';

// import base/object.js
// import fetch/fetch.js
// import fetch/feed-coerce-from-response.js
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
// TODO: return array instead of object for simpler destructuring
async function subscription_add(feed) {
  console.assert(this instanceof subscription_context);
  console.assert(indexeddb_is_open(this.reader_conn));
  console.assert(indexeddb_is_open(this.icon_conn));
  console.assert(feed_is_feed(feed));



  // TODO: rather than assert below, check whether feed has a url. If it does
  // not then this is an error and this should return an error status code
  // and exit early.

  const url_string = feed_get_top_url(feed);
  console.assert(url_string);

  console.log('subscription_add', url_string);

  let status = await subscription_url_is_unique(url_string, this.reader_conn);
  if(status !== STATUS_OK) {
    return {'status' : status};
  }

  // skip the favicon lookup while offline
  // TODO: maybe should not skip if cache-only lookup could still work
  if('onLine' in navigator && !navigator.onLine) {
    return await subscription_put_feed(feed, this.reader_conn, this.notify);
  }

  let response;
  try {
    response = await fetch_feed(url_string, this.timeout_ms);
  } catch(error) {
    console.warn(error);
    return {'status': ERR_FETCH};
  }

  // If fetch_feed did not throw then response should always be defined.
  console.assert(response);

  if(response.redirected) {
    status = await subscription_url_is_unique(response.response_url,
      this.reader_conn);
    if(status !== STATUS_OK) {
      return {'status' : status};
    }

    // TODO: add response_url to feed here instead of in coerce?
  }

  let xml_string;
  try {
    xml_string = await response.text();
  } catch(error) {
    console.warn(error);
    return ERR_FETCH;
  }

  let coerce_result;
  try {
    coerce_result = feed_coerce_from_response(xml_string,
      response.request_url, response.response_url, response.last_modified_date);
  } catch(error) {
    console.warn(error);
    return {'status': ERR_PARSE};
  }

  const merged_feed = feed_merge(feed, coerce_result.feed);

  console.assert(merged_feed);

  // ignore result status, icon update failure is non-fatal
  await feed_update_favicon(merged_feed, this.icon_conn);

  return await subscription_put_feed(merged_feed, this.reader_conn,
    this.notify);
}

// Return the status. Return ok if not already exists. Returns not ok if
// exists or error.
async function subscription_url_is_unique(url_string, reader_conn) {
  try {
    if(await reader_db_find_feed_id_by_url(reader_conn, url_string))
      return ERR_DB;
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }
  return STATUS_OK;
}

// TODO: this should delegate to reader_storage_put_feed instead
// and subscription_feed_prep should be deprecated as well
// I think first step would be to inline this function, because right now it
// composes prep, store, and notify together.
async function subscription_put_feed(feed, reader_conn, notify) {
  const storable_feed = subscription_feed_prep(feed);
  let new_id;
  try {
    new_id = await reader_db_put_feed(reader_conn, storable_feed);
  } catch(error) {
    console.warn(error);
    return {'status': ERR_DB};
  }

  storable_feed.id = new_id;
  subscription_notify_add(storable_feed, notify);
  return {'status': STATUS_OK, 'feed': storable_feed};
}

function subscription_notify_add(feed, notify) {
  if(!notify) return;
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
    return ERR_DB;
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
  return STATUS_OK;
}
