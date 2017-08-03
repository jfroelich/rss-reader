// See license.md
'use strict';

{ // Begin file block scope

// console helper
async function cmd_archive_entries() {
  let max_age_ms;
  const verbose = true;
  return await archive_entries(max_age_ms, verbose);
}

// @param max_age_ms {Number} how long before an entry is considered
// archivable
// @returns number of archived entries
async function archive_entries(max_age_ms, verbose) {
  let conn, compacted_entries;

  if(typeof max_age_ms === 'undefined')
    max_age_ms = 1000 * 60 * 60 * 24 * 2; // 2 days
  else if(!Number.isInteger(max_age_ms))
    throw new TypeError(`max_age_ms is not an integer`);
  else if(max_age_ms < 0)
    throw new TypeError(`max_age_ms is negative`);

  if(verbose)
    console.log('Archiving entries older than %d ms', max_age_ms);

  try {
    conn = await reader_open_db();
    const entries = await db_load_archivable_entries(conn, max_age_ms);
    compacted_entries = compact_entries(entries, verbose);
    await db_put_entries(conn, compacted_entries);
  } finally {
    if(conn)
      conn.close();
  }

  broadcast_archive_message(compacted_entries);
  if(verbose)
    console.log('Compacted %d entries', compacted_entries.length);
  return compacted_entries.length;
}

async function db_load_archivable_entries(conn, max_age_ms) {
  const entries = await db_load_unarchived_unread_entries(conn);
  const archivable_entries = [];
  const current_date = new Date();
  for(const entry of entries) {
    const entry_age_ms = current_date - entry.dateCreated;
    if(entry_age_ms > max_age_ms)
      archivable_entries.push(entry);
  }
  return archivable_entries;
}

// Returns a Promise that resolves to an array
function db_load_unarchived_unread_entries(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.getAll(key_path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }

  return new Promise(resolver);
}

function compact_entries(entries, verbose) {
  const current_date = new Date();
  const compacted_entries = [];
  for(const entry of entries) {
    const compacted_entry = compact_entry(entry, current_date);
    if(verbose) {
      const before_sz = sizeof(entry);
      const after_sz = sizeof(compacted_entry);
      console.debug('Entry: before byte size', before_sz, 'after byte size',
        after_sz);
    }
    compacted_entries.push(compacted_entry);
  }
  return compacted_entries;
}

// Shallow copy
function compact_entry(entry, archive_date) {
  const compacted_entry = {};
  compacted_entry.dateCreated = entry.dateCreated;
  compacted_entry.dateRead = entry.dateRead;
  compacted_entry.feed = entry.feed;
  compacted_entry.id = entry.id;
  compacted_entry.readState = entry.readState;
  compacted_entry.urls = entry.urls;
  compacted_entry.archiveState = ENTRY_STATE_ARCHIVED;
  compacted_entry.dateArchived = archive_date;
  return compacted_entry;
}

function db_put_entries(conn, entries) {
  return new Promise(function(resolve, reject) {
    const current_date = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = function(event) {
      reject(tx.error);
    };
    const entry_store = tx.objectStore('entry');
    for(const entry of entries) {
      entry.dateUpdated = current_date;
      entry_store.put(entry);
    }
  });
}

function broadcast_archive_message(entries) {
  const db_channel = new BroadcastChannel('db');
  for(const entry of entries) {
    const message = {};
    message.type = 'archivedEntry';
    message.id = entry.id;
    db_channel.postMessage(message);
  }
  db_channel.close();
}

this.archive_entries = archive_entries;
this.cmd_archive_entries = cmd_archive_entries;

} // End file block scope
