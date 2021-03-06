import * as db from '/src/db/db.js';
import { INDEFINITE } from '/src/lib/deadline.js';
import { ImportFeedArgs, importFeed } from '/src/service/import-feed.js';
import showNotification from '/src/service/utils/show-notification.js';

// Subscribes to a feed. Imports the feed and its entries into the database. Throws an error if
// already subscribed or if something goes wrong. This resolves when both the feed and the entries
// are fully imported. The callback is invoked with the feed once it is stored, earlier.
export default async function subscribe(conn, iconn, url, timeout = INDEFINITE, notify,
  feedStoredCallback) {
  const resource = {};
  resource.type = 'feed';
  db.setURL(resource, url);

  const args = new ImportFeedArgs();
  args.conn = conn;
  args.iconn = iconn;
  args.feed = resource;
  args.create = true;
  args.fetchFeedTimeout = timeout;
  args.feedStoredCallback = feedStoredCallback;

  await importFeed(args);

  if (notify) {
    const feedTitle = resource.title || resource.urls[resource.urls.length - 1];
    showNotification(`Subscribed to ${feedTitle}`, resource.favicon_url);
  }

  return resource;
}
