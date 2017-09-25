'use strict';

{ // Begin file block scope

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
async function refresh_feed_icons(verbose) {
  if(verbose)
    console.log('Refreshing feed favicons...');

  let num_feeds_modified = 0;
  let reader_conn, icon_conn;
  let icon_db_name, icon_db_version, conn_timeout_ms;

  const reader_open_promise = reader_open_db();
  const icon_open_promise = favicon_open_db(icon_db_name, icon_db_version,
    conn_timeout_ms, verbose);
  const conn_promises = [reader_open_promise, icon_open_promise];
  const open_all_promise = Promise.all(conn_promises);

  try {
    const conns = await open_all_promise;
    reader_conn = conns[0];
    icon_conn = conns[1];
    const feeds = await db_load_feeds(reader_conn);
    const resolutions = await process_feeds(feeds, reader_conn, icon_conn,
      verbose);
    num_feeds_modified = count_num_modified(resolutions);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  if(verbose)
    console.log('Refreshing feed favicons modified %d feeds',
      num_feeds_modified);
  return num_feeds_modified;
}

async function process_feeds(feeds, reader_conn, icon_conn, verbose) {
  const promises = [];
  for(const feed of feeds) {
    const promise = process_feed(feed, reader_conn, icon_conn, verbose);
    promises.push(promise);
  }
  return await Promise.all(promises);
}

function count_num_modified(resolutions) {
  let num_feeds_modified = 0;
  for(const did_update of resolutions)
    if(did_update)
      num_feeds_modified++;

  return num_feeds_modified;
}

function db_load_feeds(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

// Lookup the feed's icon, update the feed in db. Return true if updated.
// TODO: separate into two functions, one that looks up, one that
// does the update?
async function process_feed(feed, reader_conn, icon_conn, verbose) {
  const lookup_url_object = Feed.prototype.create_icon_lookup_url.call(feed);
  if(!lookup_url_object)
    return false;

  // TODO: should these be parameters to this function?
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size;
  const icon_url_string = await favicon_lookup(icon_conn, lookup_url_object,
    max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size, verbose);
  if(!icon_url_string)
    return false;

  // When the feed is missing an icon, then we want to set it.
  // When the feed is not missing an icon, then we only want to set it if the
  // newly found icon is different than the current icon.
  if(feed.faviconURLString === icon_url_string)
    return false;

  if(verbose)
    console.log('Changing feed icon url from %s to %s', feed.faviconURLString,
      icon_url_string);

  // Otherwise the icon changed, or the feed was missing an icon
  feed.faviconURLString = icon_url_string;
  feed.dateUpdated = new Date();
  await db_put_feed(reader_conn, feed);
  return true;
}

// Overwrites a feed in the database.
// There are no side effects other than the database modification.
// @param conn {IDBDatabase} an open database connection
// @param feed {Object} the feed object to add
function db_put_feed(conn, feed) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

this.refresh_feed_icons = refresh_feed_icons;

} // End file block scope
