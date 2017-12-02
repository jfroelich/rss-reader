import assert from "/src/assert/assert.js";
import * as Feed from "/src/reader-db/feed.js";
import findEntriesInDb from "/src/reader-db/find-entries.js";
import getFeedIdsInDb from "/src/reader-db/get-feed-ids.js";
import removeEntriesFromDb from "/src/reader-db/remove-entries.js";
import {isOpen} from "/src/utils/indexeddb-utils.js";

const CHANNEL_NAME = 'reader';

// Removes entries not linked to a feed from the database
// @param conn {IDBDatabase} an open database connection
// @param limit {Number}
export default async function removeOrphanedEntries(conn, limit) {
  assert(isOpen(conn));
  const feedIds = await getFeedIdsInDb(conn);

  function isOrphan(entry) {
    const id = entry.feed;
    return !id || !Feed.isValidId(id) || !feedIds.includes(id);
  }

  const entries = await findEntriesInDb(conn, isOrphan, limit);
  console.debug('found %s orphans', entries.length);
  if(entries.length === 0) {
    return;
  }

  const orphanIds = [];
  for(const entry of entries) {
    orphanIds.push(entry.id);
  }

  // Exit early when no orphans found. This avoids some substantial processing.
  if(orphanIds.length < 1) {
    return;
  }

  await removeEntriesFromDb(conn, orphanIds);

  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}
