import * as feed_utils from '/src/db/feed-utils.js';
import {get_feed_ids} from '/src/db/get-feed-ids.js';
import {iterate_entries} from '/src/db/iterate-entries.js';
import * as types from '/src/db/types.js';

// Scans the database for entries not linked to a feed and deletes them
export async function remove_orphaned_entries(session) {
  const feed_ids = await get_feed_ids(session);
  const entry_ids = [];

  if (feed_ids.length) {
    await iterate_entries(
        session, handle_entry.bind(null, entry_ids, feed_ids));
  }

  if (session.channel) {
    for (const id of entry_ids) {
      const message = {type: 'entry-deleted', id: id, reason: 'orphan'};
      session.channel.postMessage(message);
    }
  }

  return entry_ids;
}

function handle_entry(entry_ids, feed_ids, cursor) {
  const entry = cursor.value;

  // Ignore invalid objects
  if (!types.is_entry(entry)) {
    return;
  }

  // Ignore entries with a valid feed id
  if (feed_utils.is_valid_feed_id(entry.feed)) {
    return;
  }

  // Ignore entries with a feed id that exists
  if (feed_ids.includes(entry.feed)) {
    return;
  }

  entry_ids.push(entry.id);
  cursor.delete();
}
