import * as db from '/src/db/db.js';
import lookupFeedFavicon from '/src/service/utils/lookup-feed-favicon.js';

export default async function refreshFeedIcons(conn, iconn) {
  const feeds = await db.getResources(conn, { mode: 'active-feeds', titleSort: false });
  const promises = feeds.map(feed => refreshFeedIcon(feed, conn, iconn));
  return Promise.all(promises);
}

async function refreshFeedIcon(feed, conn, iconn) {
  const iconURL = await lookupFeedFavicon(feed, iconn);
  const iconURLString = iconURL ? iconURL.href : undefined;
  if (feed.favicon_url !== iconURLString) {
    return db.patchResource(conn, { id: feed.id, favicon_url: iconURLString });
  }

  return undefined;
}
