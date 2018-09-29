import {delete_feed} from '/src/db/op/delete-feed.js';
import {get_feeds} from '/src/db/op/get-feeds.js';
import {iterate_entries} from '/src/db/op/iterate-entries.js';
import * as types from '/src/db/types.js';

// TODO: inline remove_untyped_objects_internal

// Scan the feed store and the entry store and delete any objects missing their
// hidden magic property. This is not 'thread-safe' because this uses multiple
// write transactions.
export async function remove_untyped_objects(conn, channel) {
  const {feed_ids, entry_ids} = await remove_untyped_objects_internal(conn);

  if (channel) {
    for (const id of feed_ids) {
      channel.postMessage({type: 'feed-deleted', id: id, reason: 'untyped'});
    }

    for (const id of entry_ids) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: 'untyped'});
    }
  }
}

async function remove_untyped_objects_internal(conn) {
  const removed_feed_ids = [];
  const removed_entry_ids = [];

  const feeds = get_feeds(conn, 'all', false);
  const delete_feed_promises = [];
  for (const feed of feeds) {
    if (!types.is_feed(feed)) {
      removed_feed_ids.push(feed.id);
      const promise = delete_feed(conn, feed.id);
      delete_feed_promises.push(promise);
    }
  }

  const results = await Promise.all(delete_feed_promises);
  for (const entry_ids of results) {
    for (const id of entry_ids) {
      removed_entry_ids.push(id);
    }
  }

  await iterate_entries(conn, cursor => {
    const entry = cursor.value;
    if (!types.is_entry(entry)) {
      removed_entry_ids.push(entry.id);
      cursor.delete();
    }
  });

  return {feed_ids: removed_feed_ids, entry_ids: removed_entry_ids};
}
