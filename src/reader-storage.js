// app storage module, mostly a wrapper around reader-db that integrates other modules

// TODO: drop readerStorage prefix, that is now a concern of the importing module, except maybe
// it is pointless given the following todo. can just drop prefix when splitting up.
// TODO: probably should just break up into separate modules. These functions are unrelated to
// one another apart from pertaining to the same layer. Right now this is extremely low coherency
// and is nearly a utilities file.

import assert from "/src/assert.js";
import {
  entryHasURL,
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

// Scans the database for entries missing urls are removes them
// @param conn {IDBDatabase}
// @param limit {Number} optional, if specified should be positive integer > 0
// @throws AssertionError
// @throws Error - database related
export async function readerStorageRemoveLostEntries(conn, limit) {
  assert(rdb.isOpen(conn));

  function isLost(entry) {
    return !entryHasURL(entry);
  }

  const entries = await rdb.findEntries(conn, isLost, limit);
  console.debug('found %s lost entries', entries.length);
  if(entries.length === 0) {
    return;
  }

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  await rdb.removeEntries(conn, ids);
  const channel = new BroadcastChannel('db');
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}
