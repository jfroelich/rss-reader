'use strict';

// import base/debug.js
// import reader-db.js
// import favicon.js

(function(exports) {

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
async function refresh_feed_icons() {
  DEBUG('Refreshing feed favicons...');

  let count = 0;
  let reader_conn, icon_conn;

  try {
    const conns = await Promise.all([reader_db_open(), favicon_open_db()]);
    reader_conn = conns[0];
    icon_conn = conns[1];
    const feeds = await reader_db_get_feeds(reader_conn);
    const resolutions = await process_feeds(feeds, reader_conn, icon_conn);
    count = count_num_modified(resolutions);
  } finally {
    if(reader_conn)
      reader_conn.close();
    if(icon_conn)
      icon_conn.close();
  }

  return count;
}

function process_feeds(feeds, reader_conn, icon_conn) {
  const promises = [];
  for(const feed of feeds)
    promises.push(process_feed(feed, reader_conn, icon_conn));
  return Promise.all(promises);
}

function count_num_modified(resolutions) {
  let count = 0;
  for(const did_update of resolutions)
    if(did_update)
      count++;
  return count;
}

// Lookup the feed's icon, update the feed in db. Return true if updated.
async function process_feed(feed, reader_conn, icon_conn) {
  const lookup_url_object = feed_create_icon_lookup_url(feed);
  if(!lookup_url_object)
    return false;

  // TODO: should these be parameters to this function?
  let max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size;
  const icon_url_string = await favicon_lookup(icon_conn, lookup_url_object,
    max_age_ms, fetch_html_timeout_ms, fetch_img_timeout_ms,
    min_img_size, max_img_size);

  // If we could not find an icon, then leave the feed as is. The feed may
  // have an icon but prefer to leave it over remove it.
  if(!icon_url_string)
    return false;

  // When the feed is missing an icon, then we want to set it.
  // When the feed is not missing an icon, then we only want to set it if the
  // newly found icon is different than the current icon.
  if(feed.faviconURLString === icon_url_string)
    return false;

  DEBUG('Changing feed icon url from %s to %s', feed.faviconURLString,
    icon_url_string);

  // Otherwise the icon changed
  feed.faviconURLString = icon_url_string;
  feed.dateUpdated = new Date();
  await reader_db_put_feed(reader_conn, feed);
  return true;
}

exports.refresh_feed_icons = refresh_feed_icons;

}(this));
