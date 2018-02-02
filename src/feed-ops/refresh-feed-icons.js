import {lookup as favicon_service_lookup} from '/src/favicon-service.js';
import {feed_create_favicon_lookup_url, feed_has_url, find_active_feeds, open as open_reader_db, feed_store_feed_put} from '/src/rdb.js';

// Refreshes the favicon property of feeds in the feed store
export default async function feed_store_refresh_all_icons(
    feed_conn, icon_conn, channel) {
  const dconn = feed_conn ? feed_conn : await open_reader_db();
  const feeds = await find_active_feeds(dconn);
  const partial =
      feed_store_feed_refresh_icons.bind(null, dconn, icon_conn, channel);
  const promises = feeds.map(partial);
  await Promise.all(promises);
  if (!feed_conn) {
    dconn.close();
  }
}

async function feed_store_feed_refresh_icons(conn, icon_conn, channel, feed) {
  if (!feed_has_url(feed)) {
    throw new TypeError('Feed missing url ' + feed.id);
  }

  // Throw on failure
  const favicon_lookup_url = feed_create_favicon_lookup_url(feed);

  const lookup_ctx = {};
  lookup_ctx.conn = icon_conn;
  lookup_ctx.url = favicon_lookup_url;

  // lookup errors are not fatal
  let icon_url;
  try {
    icon_url = await favicon_service_lookup(lookup_ctx);
  } catch (error) {
    console.debug(error);
  }

  // If state changed then update
  if (feed.faviconURLString !== icon_url) {
    if (icon_url) {
      feed.faviconURLString = icon_url;
    } else {
      delete feed.faviconURLString;
    }

    feed.dateUpdated = new Date();

    try {
      await feed_store_feed_put(conn, channel, feed);
    } catch (error) {
      console.error(error);
    }
  }
}
