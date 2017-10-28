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
// import feed.js
// import reader-db.js




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
  await extension_update_badge_text();
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


// Scans the database for entries that are not linked to a feed and removes
// them.
// @param conn {IDBDatabase}
async function reader_storage_remove_orphans(conn) {
  // conn assertion delegated to reader_db_find_orphaned_entries
  let ids;

  // TODO: deprecate and inline reader_db_find_orphaned_entries here

  try {
    const orphans = await reader_db_find_orphaned_entries(conn);
    ids = [];
    for(const entry of orphans) {
      ids.push(entry.id);
    }

    await reader_db_remove_entries(conn, ids);
  } catch(error) {
    return ERR_DB;
  }

  if(ids && ids.length) {
    const channel = new BroadcastChannel('db');
    const message = {'type': 'entry-deleted', 'id': null};
    for(const id of ids) {
      message.id = id;
      channel.postMessage(message);
    }
    channel.close();
  }

  return STATUS_OK;
}
