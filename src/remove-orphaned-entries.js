// See license.md

'use strict';

{ // Begin file block scope

async function removeOrphanedEntries(options) {
  options = options || {};
  let conn;
  let ids;
  let connTimeoutMillis;
  try {
    conn = await openReaderDb(options.dbName, options.dbVersion,
      connTimeoutMillis);
    const feedIds = await loadAllFeedIdsFromDb(conn);
    const entries = await loadAllEntriesFromDb(conn);
    const orphans = findOrphans(entries, feedIds);
    ids = mapEntriesToIds(orphans);
    await removeEntriesWithIds(conn, ids);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  if(ids && ids.length) {
    const channel = new BroadcastChannel('db');
    for(let id of ids) {
      const message = {'type': 'entryDeleted', 'id': id};
      channel.postMessage(message);
    }
    channel.close();
  }
}

this.removeOrphanedEntries = removeOrphanedEntries;

// Returns an array of all entries missing a feed id or have a feed id that
// does not exist in the set of feed ids
function findOrphans(entries, feedIds) {
  const orphans = [];
  for(let entry of entries) {
    if(!entry.feed) {
      orphans.push(entry);
    } else if(!feedIds.includes(entry.feed)) {
      orphans.push(entry);
    }
  }
  return orphans;
}

function mapEntriesToIds(entries) {
  const ids = [];
  for(let entry of entries) {
    ids.push(entry.id);
  }
  return ids;
}

function loadAllFeedIdsFromDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function loadAllEntriesFromDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function removeEntriesWithIds(conn, ids) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = () => resolve(ids);
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(let id of ids) {
      store.delete(id);
    }
  });
}

} // End file block scope
