import { INDEFINITE } from '/lib/deadline.js';
import * as db from '/src/db/db.js';
import { importFeed, ImportFeedArgs } from '/src/import-feed.js';
import showNotification from '/src/show-notification.js';

// Subscribes to a feed. Imports the feed and its entries into the database.
// Throws an error if already subscribed or if something goes wrong. This
// resolves when both the feed and the entries are fully imported. The callback
// is invoked with the feed once it is stored, earlier.
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
    const feedTitle = resource.title || db.getURL(resource);
    showNotification(`Subscribed to ${feedTitle}`, resource.favicon_url);
  }

  return resource;
}
