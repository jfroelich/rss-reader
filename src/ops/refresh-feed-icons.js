import get_feeds from '/src/db/ops/get-feeds.js';
import patch_feed from '/src/db/ops/patch-feed.js';
import lookup_feed_favicon from '/src/ops/lookup-feed-favicon.js';

export default async function refresh_feed_icons(conn, iconn) {
  const feeds = await get_feeds(conn, 'active', false);
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(feed, conn, iconn));
  }
  return Promise.all(promises);
}

// Returns a promise that resolves to either undefined or the promise returned
// by patch-feed, which resolves when the feed is updated.
async function refresh_feed_icon(feed, conn, iconn) {
  const icon_url = await lookup_feed_favicon(feed, iconn);
  const icon_url_string = icon_url ? icon_url.href : undefined;
  if (feed.favicon_url !== icon_url_string) {
    console.debug(
        'Updating feed favicon', {id: feed.id, icon: icon_url_string});
    return patch_feed(conn, {id: feed.id, favicon_url: icon_url_string});
  }
}
