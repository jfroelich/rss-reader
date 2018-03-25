import {feed_create_favicon_lookup_url, feed_has_url} from '/src/app/objects/feed.js';
import {find_active_feeds} from '/src/app/operations/find-active-feeds.js';
import {update_feed} from '/src/app/operations/update-feed.js';
import {FaviconService} from '/src/favicon-service/favicon-service.js';

export async function refresh_feed_icons(feed_conn, icon_conn, channel) {
  const fs = new FaviconService();
  fs.conn = icon_conn;

  const feeds = await find_active_feeds(dconn);
  const partial = refresh_feed.bind(null, dconn, fs, channel);
  const promises = feeds.map(partial);
  await Promise.all(promises);
}

async function refresh_feed(conn, fs, channel, feed) {
  if (!feed_has_url(feed)) {
    return;
  }

  const lookup_url = feed_create_favicon_lookup_url(feed);
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
