import * as desknote from '/src/control/desknote.js';
import {INDEFINITE} from '/src/lib/deadline.js';
import {Feed} from '/src/model/feed.js';
import {import_feed, ImportFeedArgs} from '/src/ops/import-feed.js';

// Subscribes to a feed. Imports the feed and its entries into the database.
// Throws an error if already subscribed or if something goes wrong. This
// resolves when both the feed and the entries are fully imported. The callback
// is invoked with the feed once it is stored, earlier.
export async function subscribe(
    model, iconn, url, timeout = INDEFINITE, notify, feed_stored_callback) {
  const feed = new Feed();
  feed.appendURL(url);

  const args = new ImportFeedArgs();
  args.model = model;
  args.iconn = iconn;
  args.feed = feed;
  args.create = true;
  args.fetch_feed_timeout = timeout;
  args.feed_stored_callback = feed_stored_callback;

  const import_result = await import_feed(args);

  // NOTE: import-feed produces side effects, it modifies its input, so we
  // can rely on the input feed object here to be updated, instead of grabbing
  // the feed object reference from import_result, because that just refers to
  // the same object.

  if (notify) {
    const feed_title = feed.title || feed.getURLString();
    const note = {};
    note.title = 'RSS Reader';
    note.message = 'Subscribed to ' + feed_title;
    note.url = feed.faviconURLString;
    desknote.show(note);
  }

  return feed;
}
