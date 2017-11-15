// Marks an entry as read in the database

import assert from "/src/assert.js";
import {entryHasURL, entryIsValidId, entryPeekURL, ENTRY_STATE_READ} from "/src/entry.js";
import * as rdb from "/src/rdb.js";
import updateBadgeText from "/src/update-badge-text.js";

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
export default async function entryMarkRead(conn, id) {
  assert(rdb.isOpen(conn));
  assert(entryIsValidId(id));

  const entry = await rdb.findEntryById(conn, id);
  if(!entry) {
    throw new rdb.NotFoundError('' + id);
  }

  if(entry.readState === ENTRY_STATE_READ) {
    throw new rdb.InvalidStateError('Entry in read state with id ' + id);
  }

  assert(entryHasURL(entry));
  const url = entryPeekURL(entry);
  console.debug('found entry to mark with url', url);

  // We have full control over the entry object from read to write, so there is no need to
  // sanitize or filter empty properties.

  entry.readState = ENTRY_STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  await rdb.putEntry(conn, entry);

  console.debug('marked entry as read with url', url);
  await updateBadgeText(conn);
}
