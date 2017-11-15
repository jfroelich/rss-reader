// app storage module, mostly a wrapper around reader-db that integrates other modules

// TODO: drop readerStorage prefix, that is now a concern of the importing module, except maybe
// it is pointless given the following todo. can just drop prefix when splitting up.

import assert from "/src/assert.js";
import {
  entryIsEntry,
  entrySanitize,
  ENTRY_STATE_UNARCHIVED,
  ENTRY_STATE_UNREAD
} from "/src/entry.js";
import {
  feedIsFeed,
  feedSanitize
} from "/src/feed.js";
import {filterEmptyProps} from "/src/object.js";
import * as rdb from "/src/rdb.js";

// @throws AssertionError
// @throws Error database related
export async function readerStoragePutFeed(feed, conn, skipPrep) {
  assert(feedIsFeed(feed));
  assert(rdb.isOpen(conn));

  let storable;
  if(skipPrep) {
    storable = feed;
  } else {
    storable = feedSanitize(feed);
    storable = filterEmptyProps(storable);
  }

  const currentDate = new Date();
  if(!('dateCreated' in storable)) {
    storable.dateCreated = currentDate;
  }
  storable.dateUpdated = currentDate;

  // Allow errors to bubble
  const newId = await rdb.putFeed(conn, storable);
  storable.id = newId;
  return storable;
}

// Stores an entry in the app's storage. This is basically a wrapper function
// of rdb.putEntry that attaches sanitization, initialization, and
// verification before storing the object. Caller should use rdb.putEntry
// to store the entry object exactly as it is without any guards or init, but
// should use this function in the ordinary case.
// @param entry {Object} an entry object
// @param conn {IDBDatabase} an open indexedDB database connection
// @throws AssertionError
// @throws Error database related
export async function readerStorageAddEntry(entry, conn) {
  assert(entryIsEntry(entry));
  assert(rdb.isOpen(conn));

  const san = entrySanitize(entry);
  const storable = filterEmptyProps(san);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  await rdb.putEntry(conn, storable);
}
