import {feed_create_favicon_lookup_url, feed_has_url} from '/src/objects/feed.js';
import {for_each_active_feed} from '/src/operations/for-each-active-feed.js';
import {update_feed} from '/src/operations/update-feed.js';

export async function refresh_feed_icons(rconn, favicon_service, channel) {
  const feeds = [];
  await for_each_active_feed(rconn, feed => feeds.push(feed));

  const partial = refresh_feed.bind(null, rconn, favicon_service, channel);
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
