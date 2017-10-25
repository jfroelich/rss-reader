'use strict';

// import base/indexeddb.js
// import base/status.js
// import entry.js
// import extension.js
// import reader-db.js

// Mark the corresponding entry as read in the database
// @param conn {IDBDatabase} an open database connection
// @param id {Number} the entry id
async function entry_mark_read(conn, id) {
  console.log('entry_mark_read id', id);
  console.assert(indexeddb_is_open(conn));
  console.assert(entry_is_valid_id(id));

  let entry;
  try {
    entry = await reader_db_find_entry_by_id(conn, id);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  console.debug('entry_mark_read found entry', entry_get_top_url(entry));

  if(!entry || entry.readState === ENTRY_STATE_READ) {
    return ERR_DB;
  }

  entry.readState = ENTRY_STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  try {
    await reader_db_put_entry(conn, entry);
  } catch(error) {
    console.warn(error);
    return ERR_DB;
  }

  console.debug('entry_mark_read updated', entry_get_top_url(entry));
  extension_update_badge_text();
  return STATUS_OK;
}
