// Lib for archiving entries

// Dependencies:
// assert.js
// debug.js
// entry.js
// reader-db.js

// Scans the database for archivable entries and archives them
// @param max_age_ms {Number} how long before an entry is considered
// archivable (using date entry created)
// @returns {Number} the number of archived entries
// TODO: write tests, create and connect to a test database, insert test data,
// test the archive, assert against the expected results, and then cleanup
async function archive_entries(conn, max_age_ms) {
  'use strict';
  if(typeof max_age_ms === 'undefined')
    max_age_ms = 1000 * 60 * 60 * 24 * 2; // 2 days in ms
  DEBUG('Archiving entries older than %d ms', max_age_ms);

/*
TODO:
Loading archivable entries from the database may be optimizable using the
right type of query, such as an index over entry state, read state, and date
created. Then again, maybe there is no need to optimize this particular type
of query if the tradeoff is a massive persistent index. The index is always
present but this operation runs in the background and rarely. Maybe it would
be better to just allow this operation to be slower. Therefore, the better
approach would just make this operation batchable. Therefore, I should look
more into setting a limit on the number of entries fetched per run, and remove
the guarantee that all archivable entries get processed per run, and shorten
the alarm period. Therefore the better thing to research is just how to set
a native limit. I think in indexedDB 2.0 if I recall there is a limit parameter
to getAll or something similar.

*/

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
