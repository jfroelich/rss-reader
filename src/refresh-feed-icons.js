import * as db from '/src/db/db.js';
import lookupFeedFavicon from '/src/lookup-feed-favicon.js';

export default async function refreshFeedIcons(conn, iconn) {
  const feeds = await db.getResources(
    { conn, mode: 'active-feeds', titleSort: false },
  );
  const promises = [];
  for (const feed of feeds) {
    promises.push(refresh_feed_icon(feed, conn, iconn));
  }
  return Promise.all(promises);
}

// Returns a promise that resolves to either undefined or the promise returned
// by patch-feed, which resolves when the feed is updated.
async function refresh_feed_icon(feed, conn, iconn) {
  const icon_url = await lookupFeedFavicon(feed, iconn);
  const icon_url_string = icon_url ? icon_url.href : undefined;
  if (feed.favicon_url !== icon_url_string) {
    console.debug(
      'Updating feed favicon', { id: feed.id, icon: icon_url_string },
    );
    return db.patchResource(conn, { id: feed.id, favicon_url: icon_url_string });
  }
}
