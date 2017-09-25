'use strict';

{ // Begin file block scope

// TODO: only load entries missing urls instead of filtering after load
async function remove_entries_missing_urls() {
  const channel = new BroadcastChannel('db');
  let num_entries_removed = 0;
  let conn;
  try {
    conn = await reader_open_db();
    const invalid_entries = await db_find_invalid_entries(conn);
    const entry_ids = map_entries_to_ids(invalid_entries);
    await db_remove_entries(conn, entry_ids, channel);
    num_entries_removed = entry_ids.length;
  } finally {
    if(conn)
      conn.close();
    channel.close();
  }
  return num_entries_removed;
}

async function db_find_invalid_entries(conn) {
  // TODO: avoid loading all entries from the database. This
  // involves too much processing. It probably easily triggers a violation
  // message that appears in the console for taking too long.
  // Maybe using a cursor walk instead of get all avoids this?
  const entries = await db_get_entries(conn);
  const invalid_entries = [];
  for(const entry of entries)
    if(!entry.urls || !entry.urls.length)
      invalid_entries.push(entry);
  return invalid_entries;
}

function db_get_entries(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry', 'readonly');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

// Map an array of entries into an array of ids
function map_entries_to_ids(entries) {
  const entry_ids = [];
  for(const entry of entries)
    entry_ids.push(entry.id);
  return entry_ids;
}

function db_remove_entry(tx, id, channel) {
  function resolver(resolve, reject) {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      if(channel)
        channel.postMessage({'type': 'entryDeleted', 'id': id});
      resolve();
    };
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

async function db_remove_entries(conn, entry_ids, channel) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = [];
  for(const entry_id of entry_ids) {
    const promise = db_remove_entry(tx, entry_id, channel);
    promises.push(promise);
  }
  return await Promise.all(promises);
}

// Exports
this.remove_entries_missing_urls = remove_entries_missing_urls;

} // End file block scope
