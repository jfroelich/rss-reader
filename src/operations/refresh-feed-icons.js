import {feed_create_favicon_lookup_url, feed_has_url} from '/src/objects/feed.js';
import {find_active_feeds} from '/src/operations/find-active-feeds.js';
import {update_feed} from '/src/operations/update-feed.js';

export async function refresh_feed_icons(feed_conn, favicon_service, channel) {
  const feeds = await find_active_feeds(feed_conn);
  const partial = refresh_feed.bind(null, feed_conn, favicon_service, channel);
  const promises = feeds.map(partial);
  await Promise.all(promises);
}

async function refresh_feed(conn, favicon_service, channel, feed) {
  if (!feed_has_url(feed)) {
    return;
  }

  const lookup_url = feed_create_favicon_lookup_url(feed);
  if (!lookup_url) {
    return;
  }

  const icon_url_string = await fs.lookup(lookup_url);

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    const validate = false;
    const set_date_updated = true;
    await update_feed(conn, channel, feed, validate, set_date_updated);
  }
}