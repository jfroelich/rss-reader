(function(exports) {
'use strict';

// @param max_age_ms {Number} how long before an entry is considered
// archivable (diff compared using date entry created)
// @returns number of archived entries
async function archive_entries(max_age_ms, verbose) {
  if(typeof max_age_ms === 'undefined')
    max_age_ms = 1000 * 60 * 60 * 24 * 2; // 2 days in ms
  else if(!Number.isInteger(max_age_ms))
    throw new TypeError(`max_age_ms is not an integer`);
  else if(max_age_ms < 0)
    throw new TypeError(`max_age_ms is negative`);

  if(verbose)
    console.log('Archiving entries older than %d ms', max_age_ms);

  let db_name, db_version, db_conn_timeout;
  let conn, compacted_entries;
  let did_put_entries = false;
  try {
    conn = await reader_db.open(db_name, db_version, db_conn_timeout, verbose);
    const entries = await find_archivable_entries(conn, max_age_ms);
    compacted_entries = compact_entries(entries, verbose);
    await reader_db.put_entries(conn, compacted_entries);
    did_put_entries = true;
  } finally {
    if(conn)
      conn.close();
  }

  // After the transaction commits. Use small messages to scale independently
  // of the number of entries.
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

  if(verbose)
    console.log('Compacted %d entries', compacted_entries.length);

  return compacted_entries.length;
}

function compact_entries(entries, verbose) {
  const compacted_entries = [];
  for(const entry of entries) {
    const compacted_entry = compact_entry(entry, verbose);
    compacted_entries.push(compacted_entry);
  }
  return compacted_entries;
}

// TODO: think of how to optimize this, instead of loading more entries than
// is needed and then filtering. There should be a simply way to query against
// date created as well as the other state properties
// TODO: maybe this should be in the database layer (in reader_db), even if
// not optimized
async function find_archivable_entries(conn, max_age_ms) {
  const entries = await reader_db.load_unarchived_unread_entries2(conn);
  const archivable_entries = [];
  const current_date = new Date();
  for(const entry of entries) {
    console.assert(entry.dateCreated);
    const entry_age_ms = current_date - entry.dateCreated;
    if(entry_age_ms > max_age_ms)
      archivable_entries.push(entry);
  }
  return archivable_entries;
}

exports.archive_entries = archive_entries;

}(this));
