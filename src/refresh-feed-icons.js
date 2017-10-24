'use strict';

// import base/status.js
// import favicon.js
// import feed.js
// import reader-db.js

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
async function refresh_feed_icons(reader_conn, icon_conn) {
  console.log('refresh_feed_icons started');

  // Load all feeds from the database
  let feeds;
  try {
    feeds = await reader_db_get_feeds(reader_conn);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  // Initialize all update tasks so that they run concurrently
  const promises = [];
  for(const feed of feeds) {
    promises.push(refresh_feed_icons_update_icon(feed, reader_conn, icon_conn));
  }

  // Wait until all update calls complete
  // Ignore error statuses for individual updates
  await Promise.all(promises);

  console.log('refresh_feed_icons completed');
  return STATUS_OK;
}

// Lookup the feed's icon, update the feed in db
async function refresh_feed_icons_update_icon(feed, reader_conn, icon_conn) {
  console.debug('inspecting feed', feed_get_top_url(feed));

  const query = new FaviconQuery();
  query.conn = icon_conn;

  // feed_create_icon_lookup_url should never throw, so no try catch. If any
  // error does occur let it bubble up unhandled.
  query.url = feed_create_icon_lookup_url(feed);

  // feed_create_icon_lookup_url should always return a url. double check.
  console.assert(query.url);

  // Lookup the favicon url
  // TODO: once favicon_lookup returns a status, check if it is ok, and if not,
  // return whatever is that status.
  let icon_url;
  try {
    icon_url = await favicon_lookup(query);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  // If we could not find an icon, then leave the feed as is
  if(!icon_url) {
    return STATUS_OK;
  }

  const prev_icon_url = feed.faviconURLString;

  // For some reason, this section of code always feels confusing. Rather than
  // using a concise condition, I've written comments in each branch.

  if(prev_icon_url) {
    // The feed has an existing favicon

    if(prev_icon_url === icon_url) {
      // The new icon is the same as the current icon, so exit.
      return STATUS_OK;
    } else {
      // The new icon is different than the current icon, fall through
    }

  } else {
    // The feed is missing a favicon, and we now have an icon. Fall through
    // to set the icon.
  }

  // Set the new icon
  console.debug('updating feed favicon %s to %s', prev_icon_url, icon_url);
  feed.faviconURLString = icon_url;
  feed.dateUpdated = new Date();

  try {
    await reader_db_put_feed(reader_conn, feed);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  return STATUS_OK;
}
