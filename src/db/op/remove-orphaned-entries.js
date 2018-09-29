import * as feed_utils from '/src/db/feed-utils.js';
import {get_feed_ids} from '/src/db/op/get-feed-ids.js';
import {iterate_entries} from '/src/db/op/iterate-entries.js';
import * as types from '/src/db/types.js';

// Scans the database for entries not linked to a feed and deletes them
export async function remove_orphaned_entries(conn, channel) {
  const ids = await remove_orphaned_entries_internal(conn);

  if (channel) {
    for (const id of ids) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: 'orphan'});
    }
  }

  return ids;
}

// TODO: inline
async function remove_orphaned_entries_internal(conn) {
  const entry_ids = [];
  const feed_ids = await get_feed_ids(conn);
  if (!feed_ids.length) {
    return entry_ids;
  }

  await iterate_entries(conn, cursor => {
    const entry = cursor.value;

    if (!types.is_entry(entry)) {
      console.warn('Loaded entry is not an entry ' + JSON.stringify(entry));
      return;
    }

    if (feed_utils.is_valid_feed_id(entry.feed)) {
      return;
    }

    if (feed_ids.includes(entry.feed)) {
      return;
    }

    entry_ids.push(entry.id);
    cursor.delete();
  });

  return entry_ids;
}
