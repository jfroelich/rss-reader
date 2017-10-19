'use strict';

// Dependencies:
// assert.js
// debug.js
// entry.js
// reader-db.js

// Scans the database for archivable entries and archives them
// @param max_age_ms {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
// @returns {Number} status
async function archive_entries(conn, max_age_ms) {
  const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
  if(typeof max_age_ms === 'undefined')
    max_age_ms = TWO_DAYS_MS;

  ASSERT(idb_conn_is_open(conn));
  // max_age_ms assertion delegated to reader_db_find_archivable_entries
  // because it is merely forwarded here

  DEBUG('archiving entries older than %d ms', max_age_ms);

  let compacted_entries = [];
  let did_put_entries = false;
  try {
    const entries = await reader_db_find_archivable_entries(conn, max_age_ms);
    for(const entry of entries)
      compacted_entries.push(compact_entry(entry));
    await reader_db_put_entries(conn, compacted_entries);
    did_put_entries = true;
  } catch(error) {
    return ERR_DB_OP;
  }

  // Notify observers once the transaction commits. Individual messages are
  // dispatched in order to scale.
  if(did_put_entries) {
    const db_channel = new BroadcastChannel('db');
    for(const entry of compacted_entries) {
      const message = {};
      message.type = 'archived-entry';
      message.id = entry.id;
      db_channel.postMessage(message);
    }
    db_channel.close();
  }

  DEBUG('compacted %s entries', compacted_entries.length);
  return STATUS_OK;
}
