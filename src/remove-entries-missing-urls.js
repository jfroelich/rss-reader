// See license.md

'use strict';

{ // Begin file block scope

// TODO: only load entries missing urls instead of filtering after load
async function removeEntriesMissingURLs() {
  const channel = new BroadcastChannel('db');
  let numRemoved = 0;
  let conn;
  try {
    conn = await dbConnect();
    const entries = await loadAllEntriesFromDb(conn);
    const invalids = findInvalidEntries(entries);
    const entryIds = mapEntriesToIds(invalids);
    await removeEntries(conn, entryIds, channel);
    numRemoved = entryIds.length;
  } finally {
    if(conn) {
      conn.close();
    }
    channel.close();
  }
  return numRemoved;
}

this.removeEntriesMissingURLs = removeEntriesMissingURLs;

function loadAllEntriesFromDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Map an array of entries into an array of ids
function mapEntriesToIds(entries) {
  const entryIds = new Array(entries);
  for(let entry of entries) {
    entryIds.push(entry.id);
  }
  return entryIds;
}

// Returns an array subset of entries missing a url
function findInvalidEntries(entries) {
  const invalids = new Array(entries.length);
  for(let entry of entries) {
    if(!entry.urls || !entry.urls.length) {
      invalids.push(entry);
    }
  }
  return invalids;
}

function removeEntry(tx, id, channel) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      if(channel) {
        channel.postMessage({'type': 'entryDeleted', 'id': id});
      }
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}

async function removeEntries(conn, ids, channel) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = new Array(ids.length);
  for(let id of ids) {
    const promise = removeEntry(tx, id, channel);
    promises.push(promise);
  }
  const resolutions = await Promise.all(proms);
  return resolutions;
}

} // End file block scope
