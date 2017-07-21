// See license.md

'use strict';

{ // Begin file block scope

async function removeOrphanedEntries(conn) {
  const channel = new BroadcastChannel('db');
  try {
    const feedIds = await loadAllFeedIdsFromDb(conn);
    const entries = await loadAllEntriesFromDb(conn);
    const orphans = findOrphans(entries, feedIds);
    const ids = mapEntriesToIds(orphans);
    await removeEntriesWithIds(conn, ids, channel);
  } finally {
    channel.close();
  }
}

this.removeOrphanedEntries = removeOrphanedEntries;

// Returns an array of all entries missing a feed id or have a feed id that
// does not exist in the set of feed ids
function findOrphans(entries, feedIds) {
  const orphans = new Array(entries.length);
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
  const ids = new Array(entries.length);
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

async function removeEntriesWithIds(conn, ids, channel) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = new Array(ids.length);

  // Remove entries concurrently
  for(let id of ids) {
    const promise = removeEntryById(tx, id, channel);
    promises.push(promise);
  }

  // Promise.all is fail fast. If any removeEntryById call throws an exception
  // then all fail.
  const resolutions = await Promise.all(proms);
  return resolutions;
}

function removeEntryById(tx, id, channel) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      if(channel) {
        const message = {'type': 'entryDeleted', 'id': id};
        channel.postMessage(message);
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

} // End file block scope
