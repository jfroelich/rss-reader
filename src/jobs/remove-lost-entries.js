import assert from "/src/assert/assert.js";
import * as Entry from "/src/reader-db/entry.js";
import findEntriesInDb from "/src/reader-db/find-entries.js";
import removeEntriesFromDb from "/src/reader-db/remove-entries.js";
import * as idb from "/src/utils/indexeddb-utils.js";

// Scans the database for entries missing urls are removes them
// @param conn {IDBDatabase}
// @param limit {Number} optional, if specified should be positive integer > 0
// @throws Error - database related
export default async function removeLostEntries(conn, limit) {
  assert(idb.isOpen(conn));

  function isLost(entry) {
    return !Entry.hasURL(entry);
  }

  const entries = await findEntriesInDb(conn, isLost, limit);
  console.debug('found %s lost entries', entries.length);
  if(entries.length === 0) {
    return;
  }

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  await removeEntriesFromDb(conn, ids);
  const channel = new BroadcastChannel('db');
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}
