import {feed_create_favicon_lookup_url, feed_has_url} from '/src/app/objects/feed.js';
import {update_feed} from '/src/app/operations/update-feed.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';
import * as rdb from '/src/rdb/rdb.js';

export default async function rdb_refresh_feed_icons(
    feed_conn, icon_conn, channel) {
  const dconn = feed_conn ? feed_conn : await open_reader_db();
  const feeds = await rdb.find_active_feeds(dconn);
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

  const lookup_url = feed_create_favicon_lookup_url(feed);

  const fs = new FaviconService();
  fs.conn = icon_conn;
  const icon_url_string = await fs.lookup(lookup_url);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }
    feed.dateUpdated = new Date();
    await update_feed(conn, channel, feed);
  }
}
