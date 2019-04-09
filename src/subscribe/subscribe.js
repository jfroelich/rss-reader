import * as db from '/src/db/db.js';
import {INDEFINITE} from '/src/deadline/deadline.js';
import {import_feed, ImportFeedArgs} from '/src/import-feed/import-feed.js';
import show_notification from '/src/show-notification.js';

// Subscribes to a feed. Imports the feed and its entries into the database.
// Throws an error if already subscribed or if something goes wrong. This
// resolves when both the feed and the entries are fully imported. The callback
// is invoked with the feed once it is stored, earlier.
export default async function subscribe(
    conn, iconn, url, timeout = INDEFINITE, notify, feed_stored_callback) {
  const resource = {};
  resource.type = 'feed';
  db.set_url(resource, url);

  const args = new ImportFeedArgs();
  args.conn = conn;
  args.iconn = iconn;
  args.feed = resource;
  args.create = true;
  args.fetch_feed_timeout = timeout;
  args.feed_stored_callback = feed_stored_callback;

  await import_feed(args);

  if (notify) {
    const feed_title = resource.title || db.get_url(resource);
    show_notification('Subscribed to ' + feed_title, resource.favicon_url);
  }

  return resource;
}
