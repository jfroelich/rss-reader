'use strict';

// import entry.js
// import extension.js
// import favicon.js
// import feed.js
// import rbl.js
// import reader-badge.js
// import reader-db.js

// Archives certain entries in the database
// @param maxAgeMs {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
// @throws AssertionError
// @throws Error - database related
async function readerStorageArchiveEntries(conn, maxAgeMs, limit) {
  assert(isOpenDB(conn));

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

  // Allow errors to bubble
  const entries = await readerDbFindArchivableEntries(conn, isArchivable,
    limit);

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
  await readerDbPutEntry(conn, entry);
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
// NOTE: async function so technically these are all promise swallowed
// @throws AssertionError connection invalid or not open
// @throws AssertionError id invalid
// @throws Error database related
// @throws {ReaderDbNotFoundError} entry not found for id
// @throws {ReaderDbInvalidStateError} entry already read
// @throws Error entry unlocatable (missing url)
// @throws Error readerBadgeUpdate related error
async function readerStorageMarkRead(conn, id) {
  assert(isOpenDB(conn));
  assert(entryIsValidId(id));

  // Allow errors to bubble
  const entry = await readerDbFindEntryById(conn, id);
  if(!entry) {
    throw new ReaderDbNotFoundError('' + id);
  } else if(entry.readState === ENTRY_STATE_READ) {
    throw new ReaderDbInvalidStateError('Entry in read state with id ' + id);
  }

  assert(entryHasURL(entry));
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
  await readerBadgeUpdate(conn);
}

// @throws AssertionError
// @throws Error database related
async function readerStoragePutFeed(feed, conn, skipPrep) {
  assert(feedIsFeed(feed));
  assert(isOpenDB(conn));

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
  const newId = await readerDbPutFeed(conn, storable);
  storable.id = newId;
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
  assert(isOpenDB(conn));

  const san = entrySanitize(entry);
  const storable = filterEmptyProps(san);
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
  assert(isOpenDB(conn));

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
async function readerStorageRemoveLostEntries(conn, limit) {
  assert(isOpenDB(conn));

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
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
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
  assert(isOpenDB(readerConn));
  assert(isOpenDB(iconConn));

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
