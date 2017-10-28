'use strict';

// import base/status.js
// import reader-db.js

// TODO: move to reader-storage.js

async function remove_entries_missing_urls(conn) {
  const channel = new BroadcastChannel('db');
  try {
    const invalid_entries = await reader_db_find_entries_missing_urls(conn);
    const ids = [];
    for(const entry of invalid_entries) {
      ids.push(entry.id);
    }
    await reader_db_remove_entries(conn, ids, channel);
  } catch(error) {
    return ERR_DB;
  } finally {
    channel.close();
  }
  return STATUS_OK;
}
