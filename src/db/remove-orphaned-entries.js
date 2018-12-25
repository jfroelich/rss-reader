import {get_feed_ids} from '/src/db/get-feed-ids.js';
import {iterate_entries} from '/src/db/iterate-entries.js';
import * as types from '/src/db/types.js';

// Scans the database for entries not linked to a feed and deletes them
export async function remove_orphaned_entries(session) {
  const feed_ids = await get_feed_ids(session);
  const entry_ids = [];

  // NOTE: this previously checked if feed_ids was not empty, and only iterated
  // if not empty. This was wrong because it did not account for a database
  // state where entries existed but feeds did not. That state seems impossible
  // to create through normal app usage, but it is possible in the test context,
  // so the check was removed. It is not much of an optimization anyway. Even if
  // it was a material optimization, it is a trivial concern. Moreover it is a
  // premature concern (overoptimizing without profiling).

  await iterate_entries(session, handle_entry.bind(null, entry_ids, feed_ids));

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

  // Ignore invalid objects, that is some other module's concern
  if (!types.is_entry(entry)) {
    return;
  }

  // Ignore entries with a feed id that exists, these are valid entries
  if (feed_ids.includes(entry.feed)) {
    return;
  }

  // The entry either does not have a feed id, or does not have a valid feed id,
  // or has a valid feed id but does not correspond to a known feed, so it is
  // an orphan.

  entry_ids.push(entry.id);
  cursor.delete();
}
