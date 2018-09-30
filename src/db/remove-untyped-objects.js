import {delete_feed} from '/src/db/delete-feed.js';
import {get_feeds} from '/src/db/get-feeds.js';
import {iterate_entries} from '/src/db/iterate-entries.js';
import * as types from '/src/db/types.js';

// TODO: somehow use a single transaction?

// Scan the feed store and the entry store and delete any objects missing their
// hidden magic property. This uses multiple transactions.
export async function remove_untyped_objects(session) {
  // Find and delete untyped feeds
  const feeds = get_feeds(session, 'all', false);
  const delete_feed_promises = [];
  for (const feed of feeds) {
    if (!types.is_feed(feed)) {
      const promise = delete_feed(session, feed.id, 'untyped');
      delete_feed_promises.push(promise);
    }
  }
  const results = await Promise.all(delete_feed_promises);

  // NOTE: the above may also delete entries implicitly. Messages are sent for
  // those entries by delete-feed. We do not need to track nor send messages
  // for those deleted entries. We are using multiple transactions and the
  // above transactions completed.

  // Find and delete untyped entries
  const entry_ids = [];
  await iterate_entries(session, cursor => {
    const entry = cursor.value;
    if (!types.is_entry(entry)) {
      entry_ids.push(entry.id);
      cursor.delete();
    }
  });

  // NOTE: we do not send messages for deleted feeds here because delete-feed
  // already did that.
  if (session.channel) {
    for (const id of entry_ids) {
      const message = {type: 'entry-deleted', id: id, reason: 'untyped'};
      session.channel.postMessage(message);
    }
  }
}
