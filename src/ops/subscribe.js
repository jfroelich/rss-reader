import * as db from '/src/db/db.js';
import show_notification from '/src/show-notification.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import {import_feed, ImportFeedArgs} from '/src/ops/import-feed.js';

// Subscribes to a feed. Imports the feed and its entries into the database.
// Throws an error if already subscribed or if something goes wrong. This
// resolves when both the feed and the entries are fully imported. The callback
// is invoked with the feed once it is stored, earlier.
export default async function subscribe(
    conn, iconn, url, timeout = INDEFINITE, notify, feed_stored_callback) {
  const feed = {};
  db.set_url(feed, url);

  const args = new ImportFeedArgs();
  args.conn = conn;
  args.iconn = iconn;
  args.feed = feed;
  args.create = true;
  args.fetch_feed_timeout = timeout;
  args.feed_stored_callback = feed_stored_callback;

  await import_feed(args);

  if (notify) {
    const feed_title = feed.title || db.get_url(feed);
    show_notification('Subscribed to ' + feed_title, feed.favicon_url);
  }

  return feed;
}
