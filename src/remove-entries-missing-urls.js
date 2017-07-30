// See license.md

'use strict';

{ // Begin file block scope

// TODO: only load entries missing urls instead of filtering after load
async function removeEntriesMissingURLs() {
  const channel = new BroadcastChannel('db');
  let numRemoved = 0;
  let conn;
  try {
    conn = await openReaderDb();
    const invalids = await loadInvalidEntriesFromDb(conn);
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

async function loadInvalidEntriesFromDb(conn) {
  // TODO: avoid loading all entries from the database. This
  // involves too much processing. It probably easily triggers a violation
  // message that appears in the console for taking too long.
  // Maybe using a cursor walk instead of get all avoids this?
  const entries = await loadAllEntriesFromDb(conn);
  const invalidEntries = findInvalidEntries(entries);
  return invalidEntries;
}

function loadAllEntriesFromDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readonly');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Returns an array subset of entries missing a url
function findInvalidEntries(entries) {
  const invalids = [];
  for(let entry of entries) {
    if(!entry.urls || !entry.urls.length) {
      invalids.push(entry);
    }
  }
  return invalids;
}

// Map an array of entries into an array of ids
function mapEntriesToIds(entries) {
  const entryIds = [];
  for(let entry of entries) {
    entryIds.push(entry.id);
  }
  return entryIds;
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
  const promises = [];
  for(let id of ids) {
    const promise = removeEntry(tx, id, channel);
    promises.push(promise);
  }
  const resolutions = await Promise.all(proms);
  return resolutions;
}

// Exports
this.removeEntriesMissingURLs = removeEntriesMissingURLs;

} // End file block scope
