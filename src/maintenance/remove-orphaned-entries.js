'use strict';

{ // Begin file block scope

// TODO: use explicit options
async function remove_orphaned_entries(options) {
  options = options || {};
  let conn, entry_ids, conn_timeout_ms;
  try {
    conn = await reader_open_db(options.dbName, options.dbVersion,
      conn_timeout_ms);
    const feed_ids = await db_load_feed_ids(conn);
    const entries = await db_load_entries(conn);
    const orphans = filter_orphaned_entries(entries, feed_ids);
    entry_ids = map_entries_to_ids(orphans);
    await db_remove_entries(conn, entry_ids);
  } finally {
    if(conn)
      conn.close();
  }

  if(entry_ids && entry_ids.length) {
    const channel = new BroadcastChannel('db');
    for(const id of entry_ids) {
      const message = {'type': 'entryDeleted', 'id': id};
      channel.postMessage(message);
    }
    channel.close();
  }
}

// Returns an array of all entries missing a feed id or have a feed id that
// does not exist in the set of feed ids
function filter_orphaned_entries(entries, feed_ids) {
  const orphaned_entries = [];
  for(const entry of entries) {
    if(!entry.feed)
      orphaned_entries.push(entry);
    else if(!feed_ids.includes(entry.feed))
      orphaned_entries.push(entry);
  }
  return orphaned_entries;
}

function map_entries_to_ids(entries) {
  const entry_ids = [];
  for(const entry of entries)
    entry_ids.push(entry.id);
  return entry_ids;
}

function db_load_feed_ids(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

function db_load_entries(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

function db_remove_entries(conn, entry_ids) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = () => resolve(entry_ids);
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(const entry_id of entry_ids)
      store.delete(entry_id);
  }
  return new Promise(resolver);
}

this.remove_orphaned_entries = remove_orphaned_entries;

} // End file block scope
