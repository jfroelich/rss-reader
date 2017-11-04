'use strict';

// import base/assert.js
// import base/indexeddb.js
// import base/object.js
// import entry.js
// import extension.js
// import favicon.js
// import feed.js
// import reader-badge.js
// import reader-db.js

// Archives certain entries in the database
// @param maxAgeMs {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
// @returns {Number} status
// @throws AssertionError
// @throws Error - database related
async function readerStorageArchiveEntries(conn, maxAgeMs, limit) {
  assert(indexedDBIsOpen(conn));

  const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = TWO_DAYS_MS;
  }

  assert(numberIsPositiveInteger(maxAgeMs));

  const currentDate = new Date();
  function isArchivable(entry) {
    const entryAgeMs = currentDate - entry.dateCreated;
    return entryAgeMs > maxAgeMs;
  }

  // TODO: now that this uses a cursor, I just realized that unless I
  // handle the item during iteration, this is technically slower than
  // simply calling getAll with a second parameter that specifies a limit

  // Allow errors to bubble
  let entries = await readerDbFindArchivableEntries(conn, isArchivable, limit);

  if(!entries.length) {
    console.debug('no archivable entries found');
    return;
  }

  const compactedEntries = [];
  for(const entry of entries) {
    compactedEntries.push(entryCompact(entry));
  }
  entries = compactedEntries;

  // Allow errors to bubble
  await readerDbPutEntries(conn, entries);

  const channel = new BroadcastChannel('db');
  const message = {'type': 'archived-entry', 'id': undefined};
  for(const entry of entries) {
    message.id = entry.id;
    channel.postMessage(message);
  }
  channel.close();

  console.log('compacted %s entries', entries.length);
}

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
// NOTE: async function so technically these are all promise swallowed
// @throws AssertionError connection invalid or not open
// @throws AssertionError id invalid
// @throws Error database related
// @throws {ReaderDbNotFoundError} entry not found for id
// @throws {ReaderDbInvalidStateError} entry already read
// @throws Error entry unlocatable (missing url)
// @throws Error readerUpdateBadge related error
async function readerStorageMarkRead(conn, id) {
  assert(indexedDBIsOpen(conn));
  assert(entryIsValidId(id));

  // Allow errors to bubble
  const entry = await readerDbFindEntryById(conn, id);
  if(!entry) {
    throw new ReaderDbNotFoundError('' + id);
  } else if(entry.readState === ENTRY_STATE_READ) {
    throw new ReaderDbInvalidStateError('Entry in read state with id ' + id);
  }

  // Allow errors to bubble
  const entryURL = entryPeekURL(entry);
  console.debug('found entry', entryURL);

  // We have full control over the entry object from read to write, so
  // there is no need to re-sanitize or re-filter empty properties.
  // TODO: create readerStoragePutEntry, delegate the call to readerDbPutEntry
  // to readerStoragePutEntry, specify a skip-prep parameter because we have
  // full control over the entry object lifetime from read to write

  entry.readState = ENTRY_STATE_READ;

  // TODO: create readerStoragePutEntry and defer setting dateUpdated to
  // readerStoragePutEntry
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  // Allow errors to bubble
  await readerDbPutEntry(conn, entry);

  console.debug('updated entry', entryURL);

  // Allow errors to bubble
  await readerUpdateBadge(conn);
}

// @throws AssertionError
// @throws Error database related
async function readerStoragePutFeed(feed, conn, skipPrep) {
  assert(feedIsFeed(feed));
  assert(indexedDBIsOpen(conn));

  let storable;
  if(skipPrep) {
    storable = feed;
  } else {
    storable = feedSanitize(feed);
    storable = objectFilterEmptyProps(storable);
  }

  // TODO: set dateCreated if not set

  storable.dateUpdated = new Date();

  // TODO: ensure that if put is add that new id is set on resulting feed
  await readerDbPutFeed(conn, storable);

  // TODO: return the feed returned by readerDbPutFeed instead of the feed
  // given to readerDbPutFeed
  return storable;
}

// Stores an entry in the app's storage. This is basically a wrapper function
// of readerDbPutEntry that attaches sanitization, initialization, and
// verification before storing the object. Caller should use readerDbPutEntry
// to store the entry object exactly as it is without any guards or init, but
// should use this function in the ordinary case.
// @param entry {Object} an entry object
// @param conn {IDBDatabase} an open indexedDB database connection
// @throws AssertionError
// @throws Error database related
async function readerStorageAddEntry(entry, conn) {
  assert(entryIsEntry(entry));
  assert(indexedDBIsOpen(conn));

  const san = entrySanitize(entry);
  const storable = objectFilterEmptyProps(san);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  await readerDbPutEntry(conn, storable);
}

// Removes entries not linked to a feed from the database
// @param conn {IDBDatabase} an open database connection
// @param limit {Number}
// @throws AssertionError
// @throws Error - database-related error
async function readerStorageRemoveOrphans(conn, limit) {
  assert(indexedDBIsOpen(conn));

  // Allow errors to bubble
  const feedIds = await readerDbGetFeedIds(conn);

  assert(feedIds);

  function isOrphan(entry) {
    const id = entry.feed;
    return !id || !feedIsValidId(id) || !feedIds.includes(id);
  }

  // Allow errors to bubble
  const entries = await readerDbFindEntries(conn, isOrphan, limit);
  console.debug('found %s orphans', entries.length);
  if(entries.length === 0) {
    return;
  }

  const orphanIds = [];
  for(const entry of entries) {
    orphanIds.push(entry.id);
  }

  // Allow errors to bubble
  await readerDbRemoveEntries(conn, orphanIds);

  const channel = new BroadcastChannel('db');
  const message = {'type': 'entry-deleted', 'id': undefined,
    'reason': 'orphan'};
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
async function readerStorageRemoveLostEntries(conn, limit) {
  assert(indexedDBIsOpen(conn));

  function isLost(entry) {
    return !entryHasURL(entry);
  }

  // Allow errors to bubble
  const entries = await readerDbFindEntries(conn, isLost, limit);

  console.debug('found %s lost entries', entries.length);

  if(entries.length === 0) {
    return;
  }

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  // Allow errors to bubble
  await readerDbRemoveEntries(conn, ids);

  const channel = new BroadcastChannel('db');
  const message = {'type': 'entry-deleted', 'id': undefined, 'reason': 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
}

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
// TODO: consider overwriting existing icons too, given that some feed icons
// become invalid over time.
// @throws AssertionError
// @throws Error - database related
async function readerStorageRefreshFeedIcons(readerConn, iconConn) {
  assert(indexedDBIsOpen(readerConn));
  assert(indexedDBIsOpen(iconConn));

  // Allow errors to bubble
  const feeds = await readerDbGetFeeds(readerConn);

  // We control the feed object for its lifetime locally so there is no need
  // to prepare the feed before storing it back in the database
  const SKIP_PREP = true;

  const promises = [];
  for(const feed of feeds) {
    promises.push(readerStorageUpdateIcon(feed, readerConn, iconConn,
      SKIP_PREP));
  }

  // Allow any individual failure to cancel iteration and bubble an error
  // TODO: consider promiseEvery, but then how would assertion errors bubble?
  await Promise.all(promises);
}

// Lookup the feed's icon, update the feed in db
// @param feed {Object}
// @param readerConn {IDBDatabase}
// @param iconConn {IDBDatabase}
// @param skipPrep {Boolean} whether to skip feed preparation when updating db
// @throws AssertionError
// @throws Error - database related
async function readerStorageUpdateIcon(feed, readerConn, iconConn, skipPrep) {
  assert(feedIsFeed(feed));
  assert(feedHasURL(feed));

  const query = new FaviconQuery();
  query.conn = iconConn;

  // Allow errors to bubble
  query.url = feedCreateIconLookupURL(feed);

  assert(query.url);

  // Allow errors to bubble
  const iconURL = await faviconLookup(query);
  if(!iconURL) {
    return;
  }

  const prevIconURL = feed.faviconURLString;

  // For some reason, this section of code always feels confusing
  if(prevIconURL) {
    // The feed has an existing favicon
    if(prevIconURL === iconURL) {
      // The new icon is the same as the current icon, so exit.
      return;
    } else {
      // The new icon is different than the current icon, fall through
    }
  } else {
    // The feed is missing a favicon, and we now have an icon. Fall through
    // to set the icon.
  }

  console.debug('changing favicon from %s to %s', prevIconURL, iconURL);
  feed.faviconURLString = iconURL;

  // Allow errors to bubble
  await readerStoragePutFeed(feed, readerConn, skipPrep);
}
