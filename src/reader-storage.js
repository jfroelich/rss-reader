// Reader storage module, basically a layer above rdb.js that adds functionality

// TODO: maybe break into two modules, feed-store.js, and entry-store.js, that are basically
// abstractions around rdb calls.

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

export async function feedPut(feed, conn, skipPrep) {
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

export async function entryAdd(entry, conn) {
  assert(entryIsEntry(entry));
  assert(rdb.isOpen(conn));

  const san = entrySanitize(entry);
  const storable = filterEmptyProps(san);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  await rdb.putEntry(conn, storable);
}
