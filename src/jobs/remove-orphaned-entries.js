import assert from "/src/assert.js";
import * as Feed from "/src/storage/feed.js";
import * as rdb from "/src/storage/rdb.js";

// Removes entries not linked to a feed from the database
// @param conn {IDBDatabase} an open database connection
// @param limit {Number}
export default async function removeOrphanedEntries(conn, limit) {
  assert(rdb.isOpen(conn));
  const feedIds = await rdb.getFeedIds(conn);

  function isOrphan(entry) {
    const id = entry.feed;
    return !id || !Feed.isValidId(id) || !feedIds.includes(id);
  }

  const entries = await rdb.findEntries(conn, isOrphan, limit);
  console.debug('found %s orphans', entries.length);
  if(entries.length === 0) {
    return;
  }

  const orphanIds = [];
  for(const entry of entries) {
    orphanIds.push(entry.id);
  }

  await rdb.removeEntries(conn, orphanIds);

  const channel = new BroadcastChannel('db');
  const message = {type: 'entry-deleted', id: undefined, reason: 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}
