'use strict';

// import base/assert.js
// import base/indexeddb.js
// import base/object.js
// import base/errors.js
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
async function readerStorageArchiveEntries(conn, maxAgeMs, limit) {
  console.log('readerStorageArchiveEntries start', maxAgeMs);
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

  let entries;
  try {
    entries = await readerDbFindArchivableEntries(conn, isArchivable, limit);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  if(!entries.length) {
    return RDR_OK;
  }

  const compactedEntries = [];
  for(const entry of entries) {
    compactedEntries.push(entryCompact(entry));
  }
  entries = compactedEntries;

  try {
    await readerDbPutEntries(conn, entries);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  console.log('compacted %s entries', entries.length);

  const channel = new BroadcastChannel('db');
  const message = {'type': 'archived-entry', 'id': undefined};
  for(const entry of entries) {
    message.id = entry.id;
    channel.postMessage(message);
  }
  channel.close();

  return RDR_OK;
}

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
async function readerStorageMarkRead(conn, id) {
  console.log('readerStorageMarkRead id', id);
  assert(indexedDBIsOpen(conn));
  assert(entryIsValidId(id));

  let entry;
  try {
    entry = await readerDbFindEntryById(conn, id);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  console.debug('readerStorageMarkRead found entry', entryPeekURL(entry));

  if(!entry || entry.readState === ENTRY_STATE_READ) {
    // TODO: should be ERR_INVALID_STATE or something
    return RDR_ERR_DB;
  }

  // We have full control over the entry object from read to write, so
  // there is no need to re-sanitize or re-filter empty properties.

  entry.readState = ENTRY_STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  try {
    await readerDbPutEntry(conn, entry);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  console.debug('readerStorageMarkRead updated', entryPeekURL(entry));

  // Ignore status
  await readerUpdateBadge(conn);

  return RDR_OK;
}

async function readerStoragePutFeed(feed, conn) {
  assert(feedIsFeed(feed));
  assert(indexedDBIsOpen(conn));

  let storable = feedSanitize(feed);
  storable = objectFilterEmptyProps(storable);
  storable.dateUpdated = new Date();

  // TODO: ensure that if put is add that new id is set on resulting feed
  // TODO: catch exception locally and return undefined on error
  await readerDbPutFeed(conn, storable);

  return storable;
}

// Stores an entry in the app's storage. This is basically a wrapper function
// of readerDbPutEntry that attaches sanitization, initialization, and
// verification before storing the object. Caller should use readerDbPutEntry
// to store the entry object exactly as it is without any guards or init, but
// should use this function in the ordinary case.
// @param entry {Object} an entry object
// @param conn {IDBDatabase} an open indexedDB database connection
async function readerStorageAddEntry(entry, conn) {
  assert(entryIsEntry(entry));
  assert(indexedDBIsOpen(conn));

  const san = entrySanitize(entry);
  const storable = objectFilterEmptyProps(san);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  try {
    await readerDbPutEntry(conn, storable);
  } catch(error) {
    console.warn(error, storable.urls);
    return RDR_ERR_DB;
  }

  return RDR_OK;
}

// Removes entries not linked to a feed from the database
// @param conn {IDBDatabase} an open database connection
// TODO: update all callers to use limit, implement cli
async function readerStorageRemoveOrphans(conn, limit) {
  assert(indexedDBIsOpen(conn));

  let feedIds;
  try {
    feedIds = await readerDbGetFeedIds(conn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }
  assert(feedIds);

  function isOrphan(entry) {
    const id = entry.feed;
    return !id || !feedIsValidId(id) || !feedIds.includes(id);
  }

  let entries;
  try {
    entries = await readerDbFindEntries(conn, isOrphan, limit);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  if(entries.length === 0) {
    return RDR_OK;
  }

  console.debug('found %s orphans', entries.length);

  const orphanIds = [];
  for(const entry of entries) {
    orphanIds.push(entry.id);
  }

  try {
    await readerDbRemoveEntries(conn, orphanIds);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  const channel = new BroadcastChannel('db');
  const message = {'type': 'entry-deleted', 'id': null, 'reason': 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return RDR_OK;
}

// An entry is 'lost' if it does not have a location, as in, it does not have
// one or more urls in its urls property. I've made the opinionated design
// decision that this extension is only interested in entries that have urls,
// so this is a helper function that scans the database for entries that
// are somehow missing urls are removes them. In theory this actually never
// finds any entries to remove.
// @param conn {IDBDatabase}
async function readerStorageRemoveLostEntries(conn, limit) {
  console.debug('readerStorageRemoveLostEntries start');

  function isLost(entry) {
    return !entryHasURL(entry);
  }

  let entries;
  try {
    entries = await readerDbFindEntries(conn, isLost, limit);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  if(entries.length === 0) {
    return RDR_OK;
  }

  console.debug('found %s lost entries', entries.length);

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  try {
    await readerDbRemoveEntries(conn, ids);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  const channel = new BroadcastChannel('db');
  const message = {'type': 'entry-deleted', 'id': null, 'reason': 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return RDR_OK;
}

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
// TODO: consider overwriting existing icons too, given that some feed icons
// become invalid over time.
async function readerStorageRefreshFeedIcons(readerConn, iconConn) {
  console.log('readerStorageRefreshFeedIcons start');

  let feeds;
  try {
    feeds = await readerDbGetFeeds(readerConn);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  const promises = [];
  for(const feed of feeds) {
    promises.push(readerStorageUpdateIcon(feed, readerConn, iconConn));
  }
  await Promise.all(promises);

  console.log('readerStorageRefreshFeedIcons end');
  return RDR_OK;
}

// Lookup the feed's icon, update the feed in db
async function readerStorageUpdateIcon(feed, readerConn, iconConn) {
  console.debug('inspecting feed', feedGetTopURL(feed));

  const query = new FaviconQuery();
  query.conn = iconConn;

  // feedCreateIconLookupURL should never throw, so no try catch. If any
  // error does occur let it bubble up unhandled.
  query.url = feedCreateIconLookupURL(feed);

  // feedCreateIconLookupURL should always return a url. double check.
  assert(query.url);

  // Lookup the favicon url
  // TODO: once faviconLookup returns a status, check if it is ok, and if not,
  // return whatever is that status.
  let iconURL;
  try {
    iconURL = await faviconLookup(query);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  // If we could not find an icon, then leave the feed as is
  if(!iconURL) {
    return RDR_OK;
  }

  const prevIconURL = feed.faviconURLString;

  // For some reason, this section of code always feels confusing. Rather than
  // using a concise condition, I've written comments in each branch.

  if(prevIconURL) {
    // The feed has an existing favicon

    if(prevIconURL === iconURL) {
      // The new icon is the same as the current icon, so exit.
      return RDR_OK;
    } else {
      // The new icon is different than the current icon, fall through
    }

  } else {
    // The feed is missing a favicon, and we now have an icon. Fall through
    // to set the icon.
  }

  // Set the new icon
  console.debug('updating feed favicon %s to %s', prevIconURL, iconURL);
  feed.faviconURLString = iconURL;
  feed.dateUpdated = new Date();

  try {
    await readerDbPutFeed(readerConn, feed);
  } catch(error) {
    console.warn(error);
    return RDR_ERR_DB;
  }

  return RDR_OK;
}
