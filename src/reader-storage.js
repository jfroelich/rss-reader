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
  entryIsValidId,
  entryPeekURL,
  entrySanitize,
  ENTRY_STATE_READ,
  ENTRY_STATE_UNARCHIVED,
  ENTRY_STATE_UNREAD
} from "/src/entry.js";
import {
  feedIsFeed,
  feedIsValidId,
  feedSanitize
} from "/src/feed.js";
import {isPosInt} from "/src/number.js";
import {filterEmptyProps} from "/src/object.js";
import updateBadgeText from "/src/update-badge-text.js";
import sizeof from "/src/sizeof.js";
import * as rdb from "/src/rdb.js";

// Archives certain entries in the database
// @param maxAgeMs {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
// @throws AssertionError
// @throws Error - database related
export async function readerStorageArchiveEntries(conn, maxAgeMs, limit) {
  assert(rdb.isOpen(conn));

  const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = TWO_DAYS_MS;
  }

  assert(isPosInt(maxAgeMs));

  const currentDate = new Date();
  function isArchivable(entry) {
    const entryAgeMs = currentDate - entry.dateCreated;
    return entryAgeMs > maxAgeMs;
  }

  const entries = await rdb.findArchivableEntries(conn, isArchivable, limit);

  if(!entries.length) {
    console.debug('no archivable entries found');
    return;
  }

  // Concurrently archive and store each entry
  const channel = new BroadcastChannel('db');
  const promises = [];
  for(const entry of entries) {
    promises.push(readerStorageArchiveEntry(entry, conn, channel));
  }

  // TODO: switch from Promise.all to promiseEvery?

  try {
    await Promise.all(promises);
  } finally {
    channel.close();
  }

  console.log('compacted %s entries', entries.length);
}

async function readerStorageArchiveEntry(entry, conn, bc) {
  const ce = readerStorageEntryCompact(entry);
  ce.dateUpdated = new Date();
  await rdb.putEntry(conn, entry);
  const message = {type: 'archived-entry', id: ce.id};
  bc.postMessage(message);
  return ce;
}

// Returns a new entry object that is in a compacted form. The new entry is a
// shallow copy of the input entry, where only certain properties are kept, and
// a couple properties are changed.
function readerStorageEntryCompact(entry) {
  const ce = {};
  ce.dateCreated = entry.dateCreated;
  ce.dateRead = entry.dateRead;
  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  ce.archiveState = ENTRY_STATE_ARCHIVED;
  ce.dateArchived = new Date();
  console.debug('before', sizeof(entry), 'after', sizeof(ce));
  return ce;
}

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
export async function readerStorageMarkRead(conn, id) {
  assert(rdb.isOpen(conn));
  assert(entryIsValidId(id));

  // Allow errors to bubble
  const entry = await rdb.findEntryById(conn, id);
  if(!entry) {
    throw new rdb.NotFoundError('' + id);
  } else if(entry.readState === ENTRY_STATE_READ) {
    throw new rdb.InvalidStateError('Entry in read state with id ' + id);
  }

  assert(entryHasURL(entry));
  const entryURL = entryPeekURL(entry);
  console.debug('found entry', entryURL);

  // We have full control over the entry object from read to write, so
  // there is no need to re-sanitize or re-filter empty properties.
  // TODO: create readerStoragePutEntry, delegate the call to rdb.putEntry
  // to readerStoragePutEntry, specify a skip-prep parameter because we have
  // full control over the entry object lifetime from read to write

  entry.readState = ENTRY_STATE_READ;

  // TODO: create readerStoragePutEntry and defer setting dateUpdated to
  // readerStoragePutEntry
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  // Allow errors to bubble
  await rdb.putEntry(conn, entry);

  console.debug('updated entry', entryURL);

  // Allow errors to bubble
  await updateBadgeText(conn);
}

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

// Removes entries not linked to a feed from the database
// @param conn {IDBDatabase} an open database connection
// @param limit {Number}
// @throws AssertionError
// @throws Error - database-related error
export async function readerStorageRemoveOrphans(conn, limit) {
  assert(rdb.isOpen(conn));

  // Allow errors to bubble
  const feedIds = await rdb.getFeedIds(conn);

  assert(feedIds);

  function isOrphan(entry) {
    const id = entry.feed;
    return !id || !feedIsValidId(id) || !feedIds.includes(id);
  }

  // Allow errors to bubble
  const entries = await rdb.findEntries(conn, isOrphan, limit);
  console.debug('found %s orphans', entries.length);
  if(entries.length === 0) {
    return;
  }

  const orphanIds = [];
  for(const entry of entries) {
    orphanIds.push(entry.id);
  }

  // Allow errors to bubble
  await rdb.removeEntries(conn, orphanIds);

  const channel = new BroadcastChannel('db');
  const message = {type: 'entry-deleted', id: undefined, reason: 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
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
