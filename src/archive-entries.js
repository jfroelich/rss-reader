// See license.md
'use strict';

{ // Begin file block scope

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
  try {
    conn = await reader_open_db(db_name, db_version, db_conn_timeout, verbose);
    const entries = await db_load_archivable_entries(conn, max_age_ms);
    compacted_entries = compact_entries(entries, verbose);
    await db_put_entries(conn, compacted_entries);
  } finally {
    if(conn)
      conn.close();
  }

  // After the transaction commits. Use small messages to scale independently
  // of the number of entries.
  const db_channel = new BroadcastChannel('db');
  for(const entry of compacted_entries) {
    const message = {};
    message.type = 'archived-entry';
    message.id = entry.id;
    db_channel.postMessage(message);
  }
  db_channel.close();

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

async function db_load_archivable_entries(conn, max_age_ms) {
  const entries = await db_load_unarchived_unread_entries(conn);
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

// Returns a Promise that resolves to an array
function db_load_unarchived_unread_entries(conn) {
  function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.getAll(key_path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(executor);
}

function db_put_entries(conn, entries) {
  function executor(resolve, reject) {
    const current_date = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = function tx_onerror(event) {
      reject(tx.error);
    };
    const entry_store = tx.objectStore('entry');
    for(const entry of entries) {
      entry.dateUpdated = current_date;
      entry_store.put(entry);
    }
  }
  return new Promise(executor);
}

this.archive_entries = archive_entries;

} // End file block scope
