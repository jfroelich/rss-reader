import Feed from '/src/db/feed.js';
import * as locatable from '/src/db/locatable.js';
import get_feeds from '/src/db/ops/get-feeds.js';
import put_feed from '/src/db/ops/put-feed.js';
import lookup_feed_favicon from '/src/ops/lookup-feed-favicon.js';

export default async function refresh_feed_icons(conn, iconn) {
  const feeds = await get_feeds(conn, 'active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(conn, iconn, feed));
  }
  return Promise.all(promises);
}

async function refresh_feed_icon(conn, iconn, feed) {
  // TODO: pretty sure this is paranoia (over use of caution), feeds all have
  // urls if they make into the data
  if (!locatable.has_url(feed)) {
    return;
  }

  const icon_url = await lookup_feed_favicon(feed, iconn);
  const icon_url_string = icon_url ? icon_url.href : undefined;

  if (feed.favicon_url !== icon_url_string) {
    if (icon_url_string) {
      feed.favicon_url = icon_url_string;
    } else {
      delete feed.favicon_url;
    }

    // TODO: should use patch here instead and just pass in favicon_url (either
    // with a value or undefined to signal deletion intent).
    await put_feed(conn, feed);
  }
}
