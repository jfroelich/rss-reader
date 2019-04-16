import * as db from '/src/db/db.js';
import lookupFeedFavicon from '/src/service/lookup-feed-favicon.js';

export default async function refreshFeedIcons(conn, iconn) {
  const feeds = await db.getResources(conn, { mode: 'active-feeds', titleSort: false });
  const promises = [];
  for (const feed of feeds) {
    promises.push(refreshFeedIcon(feed, conn, iconn));
  }
  return Promise.all(promises);
}

// Returns a promise that resolves to either undefined or the promise returned
// by patch-feed, which resolves when the feed is updated.
async function refreshFeedIcon(feed, conn, iconn) {
  const iconURL = await lookupFeedFavicon(feed, iconn);
  const iconURLString = iconURL ? iconURL.href : undefined;
  if (feed.favicon_url !== iconURLString) {
    console.debug('Updating feed favicon', { id: feed.id, icon: iconURLString });
    return db.patchResource(conn, { id: feed.id, favicon_url: iconURLString });
  }

  return undefined;
}
