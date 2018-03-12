import * as favicon_service from '/src/favicon-service/favicon-service.js';
import * as rdb from '/src/rdb/rdb.js';

// TODO: drop auto-connect support, use ral.js for that if desired
// TODO: add docs

export default async function rdb_refresh_feed_icons(
    feed_conn, icon_conn, channel) {
  const dconn = feed_conn ? feed_conn : await open_reader_db();
  const feeds = await rdb.rdb_find_active_feeds(dconn);
  const partial =
      feed_store_feed_refresh_icons.bind(null, dconn, icon_conn, channel);
  const promises = feeds.map(partial);
  await Promise.all(promises);
  if (!feed_conn) {
    dconn.close();
  }
}

async function feed_store_feed_refresh_icons(conn, icon_conn, channel, feed) {
  if (!rdb.rdb_feed_has_url(feed)) {
    throw new TypeError('Feed missing url ' + feed.id);
  }

  // Throw on failure
  const favicon_lookup_url = rdb.rdb_feed_create_favicon_lookup_url(feed);

  const lookup_ctx = {};
  lookup_ctx.conn = icon_conn;
  lookup_ctx.url = favicon_lookup_url;

  // lookup errors are not fatal
  let icon_url;
  try {
    icon_url = await favicon_service.lookup(lookup_ctx);
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
      await rdb.rdb_feed_put(conn, channel, feed);
    } catch (error) {
      console.error(error);
    }
  }
}
