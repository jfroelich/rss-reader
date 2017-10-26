'use strict';

// import base/object.js
// import base/status.js
// import entry.js
// import reader-db.js

// TODO: maybe this should be part of some general storage layer that wraps
// database calls with extra functionality, and I should aggregate together
// several of the other similar functions that belong in this layer into a
// single file, and make them more uniform in API surface.

// Stores an entry in the app's storage. This is basically a wrapper function
// of reader_db_put_entry that attaches sanitization, initialization, and
// verification before storing the object. Caller should use reader_db_put_entry
// to store the entry object exactly as it is without any guards or init, but
// should use this function in the ordinary case.
// @param entry {Object} an entry object
// @param conn {IDBDatabase} an open indexedDB database connection
async function reader_entry_add(entry, conn) {
  console.assert(entry_is_entry(entry));
  console.assert(indexeddb_is_open(conn));

  const san = entry_sanitize(entry);
  const storable = object_filter_empty_props(san);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  // BUG: the following message appears several times in the console:
  // Unable to add key to index 'urls': at least one key does not satisfy the
  // uniqueness requirements.
  // ["https://www.popehat.com/2017/10/24/in-which-my-identity-is-sought-by-
  // federal-grand-jury-subpoena/"]

  try {
    await reader_db_put_entry(conn, storable);
  } catch(error) {
    console.warn(error, storable.urls);
    return ERR_DB;
  }

  return STATUS_OK;
}
