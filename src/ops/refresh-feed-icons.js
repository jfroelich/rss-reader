import get_feeds from '/src/db/ops/get-feeds.js';
import update_feed from '/src/db/ops/update-feed.js';
import {Feed} from '/src/db/types/feed.js';
import {lookup_feed_favicon} from '/src/ops/lookup-feed-favicon.js';

export default async function refresh_feed_icons(conn, channel, iconn) {
  const feeds = await get_feeds(conn, 'active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(conn, channel, iconn, feed));
  }
  return Promise.all(promises);
}

async function refresh_feed_icon(conn, channel, iconn, feed) {
  if (!Feed.prototype.hasURL.call(feed)) {
    return;
  }

  const icon_url = await lookup_feed_favicon(feed, iconn);
  const icon_url_string = icon_url ? icon_url.href : undefined;

  if (feed.faviconURLString !== icon_url_string) {
    if (icon_url_string) {
      feed.faviconURLString = icon_url_string;
    } else {
      delete feed.faviconURLString;
    }

    const overwrite_flag = true;
    await update_feed(conn, channel, feed, overwrite_flag);
  }
}
