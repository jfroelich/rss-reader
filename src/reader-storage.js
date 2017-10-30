'use strict';

// reader storage is a layer between the app and reader-db.js that provides
// database related functionality with additional pre and post conditions and
// processing. For example, where as a reader-db function simply stores an
// object exactly as is, the corresponding wrapper function here attaches
// additional functionality such as sanitization and setting defaults. This
// layer also integrates other components together to bring auxillary
// functionality such as notifications or badge text update.

// import base/indexeddb.js
// import base/object.js
// import base/status.js
// import entry.js
// import extension.js
// import favicon.js
// import feed.js
// import reader-db.js

// Scans the database for archivable entries and archives them
// @param max_age_ms {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
// @returns {Number} status
async function reader_storage_archive_entries(conn, max_age_ms, limit) {
  console.log('reader_storage_archive_entries start', max_age_ms);
  console.assert(indexeddb_is_open(conn));

  const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
  if(typeof max_age_ms === 'undefined') {
    max_age_ms = TWO_DAYS_MS;
  }

  console.assert(number_is_positive_integer(max_age_ms));

  const current_date = new Date();
  function is_archivable(entry) {
    const entry_age_ms = current_date - entry.dateCreated;
    return entry_age_ms > max_age_ms;
  }

  // TODO: now that this uses a cursor, I just realized that unless I
  // handle the item during iteration, this is technically slower than
  // simply calling getAll with a second parameter that specifies a limit

  let entries;
  try {
    entries = await reader_db_find_archivable_entries(conn, is_archivable,
      limit);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  if(!entries.length) {
    return STATUS_OK;
  }

  const compacted_entries = [];
  for(const entry of entries) {
    compacted_entries.push(entry_compact(entry));
  }
  entries = compacted_entries;

  try {
    await reader_db_put_entries(conn, entries);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  console.log('compacted %s entries', entries.length);

  const channel = new BroadcastChannel('db');
  const message = {'type': 'archived-entry', 'id': undefined};
  for(const entry of entries) {
    message.id = entry.id;
    channel.postMessage(message);
  }
  channel.close();

  return STATUS_OK;
}

// Mark the entry with the given id as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} an entry id
async function reader_storage_mark_read(conn, id) {
  console.log('reader_storage_mark_read id', id);
  console.assert(indexeddb_is_open(conn));
  console.assert(entry_is_valid_id(id));

  let entry;
  try {
    entry = await reader_db_find_entry_by_id(conn, id);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  console.debug('reader_storage_mark_read found entry',
    entry_get_top_url(entry));

  if(!entry || entry.readState === ENTRY_STATE_READ) {
    // TODO: should be ERR_INVALID_STATE or something
    return ERR_DB;
  }

  // We have full control over the entry object from read to write, so
  // there is no need to re-sanitize or re-filter empty properties.

  entry.readState = ENTRY_STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  try {
    await reader_db_put_entry(conn, entry);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  console.debug('reader_storage_mark_read updated', entry_get_top_url(entry));

  // Ignore status
  await reader_update_badge(conn);

  return STATUS_OK;
}

async function reader_storage_put_feed(feed, conn) {
  console.assert(feed_is_feed(feed));
  console.assert(indexeddb_is_open(conn));

  let storable = feed_sanitize(feed);
  storable = object_filter_empty_props(storable);
  storable.dateUpdated = new Date();

  // TODO: ensure that if put is add that new id is set on resulting feed
  // TODO: catch exception locally and return undefined on error
  await reader_db_put_feed(conn, storable);

  return storable;
}

// Stores an entry in the app's storage. This is basically a wrapper function
// of reader_db_put_entry that attaches sanitization, initialization, and
// verification before storing the object. Caller should use reader_db_put_entry
// to store the entry object exactly as it is without any guards or init, but
// should use this function in the ordinary case.
// @param entry {Object} an entry object
// @param conn {IDBDatabase} an open indexedDB database connection
async function reader_storage_add_entry(entry, conn) {
  console.assert(entry_is_entry(entry));
  console.assert(indexeddb_is_open(conn));

  const san = entry_sanitize(entry);
  const storable = object_filter_empty_props(san);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  try {
    await reader_db_put_entry(conn, storable);
  } catch(error) {
    console.warn(error, storable.urls);
    return ERR_DB;
  }

  return STATUS_OK;
}

// Removes entries not linked to a feed from the database
// @param conn {IDBDatabase} an open database connection
// TODO: update all callers to use limit, implement cli
async function reader_storage_remove_orphans(conn, limit) {
  console.assert(indexeddb_is_open(conn));

  let feed_ids;
  try {
    feed_ids = await reader_db_get_feed_ids(conn);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }
  console.assert(feed_ids);

  function entry_is_orphan(entry) {
    const id = entry.feed;
    return !id || !feed_is_valid_feed_id(id) || !feed_ids.includes(id);
  }

  let entries;
  try {
    entries = await reader_db_find_entries(conn, entry_is_orphan, limit);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  if(entries.length === 0) {
    return STATUS_OK;
  }

  console.debug('found %s orphans', entries.length);

  const orphan_ids = [];
  for(const entry of entries) {
    orphan_ids.push(entry.id);
  }

  try {
    await reader_db_remove_entries(conn, orphan_ids);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  const channel = new BroadcastChannel('db');
  const message = {'type': 'entry-deleted', 'id': null, 'reason': 'orphan'};
  for(const id of orphan_ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return STATUS_OK;
}

// An entry is 'lost' if it does not have a location, as in, it does not have
// one or more urls in its urls property. I've made the opinionated design
// decision that this extension is only interested in entries that have urls,
// so this is a helper function that scans the database for entries that
// are somehow missing urls are removes them. In theory this actually never
// finds any entries to remove.
// @param conn {IDBDatabase}
async function reader_storage_remove_lost_entries(conn, limit) {
  console.debug('reader_storage_remove_lost_entries start');

  function entry_is_lost(entry) {
    return !entry_has_url(entry);
  }

  let entries;
  try {
    entries = await reader_db_find_entries(conn, entry_is_lost, limit);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  if(entries.length === 0) {
    return STATUS_OK;
  }

  console.debug('found %s lost entries', entries.length);

  const ids = [];
  for(const entry of entries) {
    ids.push(entry.id);
  }

  try {
    await reader_db_remove_entries(conn, ids);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  const channel = new BroadcastChannel('db');
  const message = {'type': 'entry-deleted', 'id': null, 'reason': 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return STATUS_OK;
}

// Scans through all the feeds in the database and attempts to update each
// feed's favicon property.
// TODO: consider overwriting existing icons too, given that some feed icons
// become invalid over time.
async function reader_storage_refresh_feed_icons(reader_conn, icon_conn) {
  console.log('reader_storage_refresh_feed_icons start');

  let feeds;
  try {
    feeds = await reader_db_get_feeds(reader_conn);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  const promises = [];
  for(const feed of feeds) {
    promises.push(reader_storage_update_icon(feed, reader_conn, icon_conn));
  }
  await Promise.all(promises);

  console.log('reader_storage_refresh_feed_icons end');
  return STATUS_OK;
}

// Lookup the feed's icon, update the feed in db
async function reader_storage_update_icon(feed, reader_conn, icon_conn) {
  console.debug('inspecting feed', feed_get_top_url(feed));

  const query = new FaviconQuery();
  query.conn = icon_conn;

  // feed_create_icon_lookup_url should never throw, so no try catch. If any
  // error does occur let it bubble up unhandled.
  query.url = feed_create_icon_lookup_url(feed);

  // feed_create_icon_lookup_url should always return a url. double check.
  console.assert(query.url);

  // Lookup the favicon url
  // TODO: once favicon_lookup returns a status, check if it is ok, and if not,
  // return whatever is that status.
  let icon_url;
  try {
    icon_url = await favicon_lookup(query);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  // If we could not find an icon, then leave the feed as is
  if(!icon_url) {
    return STATUS_OK;
  }

  const prev_icon_url = feed.faviconURLString;

  // For some reason, this section of code always feels confusing. Rather than
  // using a concise condition, I've written comments in each branch.

  if(prev_icon_url) {
    // The feed has an existing favicon

    if(prev_icon_url === icon_url) {
      // The new icon is the same as the current icon, so exit.
      return STATUS_OK;
    } else {
      // The new icon is different than the current icon, fall through
    }

  } else {
    // The feed is missing a favicon, and we now have an icon. Fall through
    // to set the icon.
  }

  // Set the new icon
  console.debug('updating feed favicon %s to %s', prev_icon_url, icon_url);
  feed.faviconURLString = icon_url;
  feed.dateUpdated = new Date();

  try {
    await reader_db_put_feed(reader_conn, feed);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  return STATUS_OK;
}
