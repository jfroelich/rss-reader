'use strict';

// import base/indexeddb.js
// import base/status.js
// import rss/entry.js
// import extension.js
// import reader-db.js

const ENTRY_MARK_READ_DEBUG = false;

// Mark the corresponding entry as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} the entry id
async function entry_mark_read(conn, id) {
  if(ENTRY_MARK_READ_DEBUG) {
    DEBUG('marking as read entry with id', id);
  }

  console.assert(indexeddb_is_open(conn));
  console.assert(entry_is_valid_id(id));

  let entry;
  try {
    entry = await reader_db_find_entry_by_id(conn, id);
  } catch(error) {
    if(ENTRY_MARK_READ_DEBUG) {
      DEBUG(error);
    }

    return ERR_DB_OP;
  }

  if(ENTRY_MARK_READ_DEBUG) {
    DEBUG('marking as read entry', entry);
  }

  if(!entry || entry.readState === ENTRY_STATE_READ) {
    return ERR_DB_STATE;
  }

  entry.readState = ENTRY_STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  try {
    await reader_db_put_entry(conn, entry);
  } catch(error) {
    DEBUG(error);
    return ERR_DB_OP;
  }

  if(ENTRY_MARK_READ_DEBUG) {
    DEBUG('marked as read entry', entry);
  }

  // Ignore error
  extension_update_badge_text();

  return STATUS_OK;
}
