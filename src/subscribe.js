// See license.md
'use strict';

{ // Begin file block scope

// Returns the feed that was added if successful
async function subscribe(reader_conn, icon_conn, feed, timeout_ms, notify,
  verbose) {

  // Default to a reasonable timeout. To avoid timeout specify 0.
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 2000;
  if(!Number.isInteger(timeout_ms))
    throw new TypeError('timeout_ms not an integer');

  if(typeof notify === 'undefined')
    notify = true;

  const url_string = Feed.prototype.get_url.call(feed);
  if(verbose)
    console.log('Subscribing to feed', url_string);

  if(await db_contains_feed_url(reader_conn, url_string)) {
    if(verbose)
      console.warn('Already subscribed to feed with url', url_string);
    return;
  }

  if('onLine' in navigator && !navigator.onLine) {
    if(verbose)
      console.debug('Proceeding with offline subscription to', url_string);
    const storable_feed = prep_feed_for_db(feed);

    const new_feed_id = await db_put_feed(reader_conn, storable_feed);
    storable_feed.id = new_feed_id;

    if(notify)
      show_subscribe_notification(storable_feed);
    return storable_feed;
  }

  // Allow fetch errors to bubble. Response is guaranteed defined if no error.
  const is_accept_html = true;
  const response = await fetch_feed(url_string, timeout_ms, is_accept_html);

  const response_url_string = response.responseURLString;
  if(response.redirected && await check_redirect_url_exists(reader_conn,
    response_url_string, verbose))
    return;

  const parse_result = parse_fetched_feed(response);
  const remote_feed = parse_result.feed;
  const merged_feed = merge_feeds(feed, remote_feed);
  await set_feed_icon(icon_conn, merged_feed, verbose);
  const storable_feed = prep_feed_for_db(merged_feed);

  const new_feed_id = await db_put_feed(reader_conn, storable_feed);
  storable_feed.id = new_feed_id;
  if(notify)
    show_subscribe_notification(storable_feed);
  return storable_feed;
}

// Looks up and set a feed's favicon
async function set_feed_icon(icon_conn, feed, verbose) {
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size, icon_url_string;
  const lookupURLObject = Feed.prototype.create_icon_lookup_url.call(feed);
  const lookupPromise = favicon_lookup(icon_conn, lookupURLObject, max_age_ms,
    fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size,
    max_img_size, verbose);
  try {
    icon_url_string = await lookupPromise;
  } catch(error) {
    if(verbose)
      console.warn(error);
  }

  if(icon_url_string) {
    feed.faviconURLString = icon_url_string;
    return true;
  }
  return false;
}

// Returns true if a feed exists in the database with the given url
function db_contains_feed_url(conn, url_string) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url_string);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

// TODO: this is so similar to db_contains_feed_url that it should be deprecated,
// the only difference is basically the log message, which isn't important
// TODO: this does not really merit being a helper function
async function check_redirect_url_exists(reader_conn,
  response_url_string, verbose) {
  if(await db_contains_feed_url(reader_conn, response_url_string)) {
    if(verbose)
      console.warn('Already subscribed to feed with redirected url',
        response_url_string);
    return true;
  }
  return false;
}

function show_subscribe_notification(feed) {
  const title = 'Subscription complete';
  const feed_name = feed.title || Feed.prototype.get_url.call(feed);
  const message = 'Subscribed to ' + feed_name;
  ext_show_notification(title, message, feed.faviconURLString);
}

// Returns a basic copy of the input feed that is suitable for storage in
// indexedDB
function prep_feed_for_db(feed) {
  let storable = Feed.prototype.sanitize.call(feed);
  storable = filter_empty_props(storable);
  storable.dateCreated = new Date();
  return storable;
}

function db_put_feed(conn, feed) {
  function executor(resolve, reject) {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = function req_onsuccess() {
      resolve(request.result);
    };
    request.onerror = function req_onerror() {
      reject(request.error);
    };
  }
  return new Promise(executor);
}

this.subscribe = subscribe;

} // End file block scope
