import * as DBService from '/src/service/db-service.js';
import lookupFeedFavicon from '/src/service/utils/lookup-feed-favicon.js';

export default async function refreshFeedIcons(conn, iconn) {
  const mode = 'active-feeds';
  const titleSort = false;
  const feeds = await DBService.getFeeds(conn, { mode, titleSort });
  const promises = feeds.map(feed => refreshFeedIcon(feed, conn, iconn));
  return Promise.all(promises);
}

async function refreshFeedIcon(feed, conn, iconn) {
  const iconURL = await lookupFeedFavicon(feed, iconn);
  const iconURLString = iconURL ? iconURL.href : undefined;
  if (feed.favicon_url !== iconURLString) {
    return DBService.patchFeed(conn, { id: feed.id, favicon_url: iconURLString });
  }

  return undefined;
}
