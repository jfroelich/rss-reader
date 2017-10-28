'use strict';

// import base/indexeddb.js
// import entry.js
// import reader-db.js

// TODO: move to reader-storage.js

// TODO: consider returning to one transaction per entry update. create a
// helper function named archive_entries_archive_entry that does compact,
// store, and notify. run the helper function concurrently on all entries
// loaded. i lose the performance of having only a single transaction, but
// i gain other benefits. i think each compact operation is isolated.
// the impact of one failure does not impact the others. compactions can
// occur in parallel. i do not need to keep everything in memory either, if
// i want to use a cursor walk approach. the compact occurs within the promise
// so that also means compacts are almost concurrent.




// Scans the database for archivable entries and archives them
// @param max_age_ms {Number} how long before an entry is considered
// archivable (using date entry created), in milliseconds
// @returns {Number} status
async function archive_entries(conn, max_age_ms) {
  const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
  if(typeof max_age_ms === 'undefined') {
    max_age_ms = TWO_DAYS_MS;
  }

  console.assert(indexeddb_is_open(conn));
  // max_age_ms assertion delegated to reader_db_find_archivable_entries
  // because the variable is not otherwise used locally

  console.log('archiving entries older than %d ms', max_age_ms);

  let compacted_entries = [];
  let did_put_entries = false;
  try {
    const entries = await reader_db_find_archivable_entries(conn, max_age_ms);
    for(const entry of entries) {
      compacted_entries.push(entry_compact(entry));
    }

    await reader_db_put_entries(conn, compacted_entries);
    did_put_entries = true;
  } catch(error) {
    return ERR_DB;
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

  console.log('compacted %s entries', compacted_entries.length);
  return STATUS_OK;
}
