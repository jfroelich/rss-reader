import assert from "/src/assert/assert.js";
import * as Entry from "/src/reader-db/entry.js";
import findEntriesInDb from "/src/reader-db/find-entries.js";
import removeEntriesFromDb from "/src/reader-db/remove-entries.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";

const CHANNEL_NAME = 'reader';

// Scans the database for entries missing urls are removes them
// @param conn {IDBDatabase}
// @param limit {Number} optional, if specified should be positive integer > 0
// @throws Error - database related
export default async function removeLostEntries(conn, limit) {
  assert(IndexedDbUtils.isOpen(conn));

  const entries = await findEntriesInDb(conn, isLostEntry, limit);
  console.debug('found %s lost entries', entries.length);
  if(entries.length === 0) {
    return;
  }

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  await removeEntriesFromDb(conn, ids);
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}

function isLostEntry(entry) {
  return !Entry.hasURL(entry);
}
