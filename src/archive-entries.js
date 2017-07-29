// See license.md
'use strict';

{ // Begin file block scope

async function commandArchiveEntries() {
  let maxAgeMillis;
  const verbose = true;
  try {
    conn = await openReaderDb();
    const numArchived = await archiveEntries(maxAgeMillis, verbose);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

// @param maxAgeMillis {Number}
// @param verbose {Boolean}
// @returns {Number} the new of archived entries
async function archiveEntries(maxAgeMillis, verbose) {
  if(typeof maxAgeMillis === 'undefined') {
    maxAgeMillis = 1 * 24 * 60 * 60 * 1000;
  }

  validateMaxAgeInMillis(maxAgeMillis);
  if(verbose) {
    console.log('Archiving entries older than %d ms', maxAgeMillis);
  }

  let conn;
  try {
    conn = await openReaderDb();
    const entries = await loadUnarchivedReadEntriesFromDb(conn);
    const archivableEntries = selectArchivableEntries(entries, maxAgeMillis);
    const compacts = compactEntries(archivableEntries, verbose);
    const putResolutions = await putEntriesInDb(conn, compacts);
  } finally {
    if(conn) {
      conn.close();
    }
  }

  broadcastArchiveMessage(compacts);
  if(verbose) {
    console.log('Archive entries completed (loaded %d, compacted %d)',
      entries.length, compacts.length);
  }
  return compacts.length;
}

function validateMaxAgeInMillis(maxAgeMillis) {
  if(!Number.isInteger(maxAgeMillis)) {
    throw new TypeError(`Invalid maxAgeMillis ${maxAgeMillis}`);
  } else if(maxAgeMillis < 0) {
    throw new TypeError(`Invalid maxAgeMillis ${maxAgeMillis}`);
  }
}

function loadUnarchivedReadEntriesFromDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.getAll(keyPath);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function selectArchivableEntries(entries, maxAgeMillis) {
  const archivableEntries = [];
  const currentDate = new Date();
  for(let entry of entries) {
    const entryAgeInMillis = currentDate - entry.dateCreated;
    if(entryAgeInMillis > maxAgeMillis) {
      archivableEntries.push(entry);
    }
  }
  return archivableEntries;
}

function compactEntries(entries, verbose) {
  const compacts = new Array(entries.length);
  for(let entry of entries) {
    const compacted = compact(entry, currentDate);
    compacts.push(compacted);
  }

  if(verbose && typeof sizeof === 'function') {
    for(let i = 0, length = entries.length; i < length; i++) {
      const beforeSize = sizeof(entries[i]);
      const afterSize = sizeof(compacts[i]);
      console.debug(beforeSize, 'compacted to', afterSize);
    }
  }

  return compacts;
}

// Promise.all is failfast so this aborts if any one entry fails
async function putEntriesInDb(conn, entries) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = new Array(entries.length);
  const currentDate = new Date();
  for(let entry of entries) {
    entry.dateUpdated = currentDate;
    const promise = putEntry(tx, entry);
    promises.push(promise);
  }
  return await Promise.all(promises);
}

// Resolves when the entry has been stored to the result of the request
// If entry.id is not set this will result in adding
// Sets dateUpdated before put. Impure.
// @param tx {IDBTransaction}
// @param entry {Object} the entry to store
function putEntry(tx, entry) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Shallow copy certain properties into a new entry
function compact(entry, archiveDate) {
  const compacted = {};
  compacted.dateCreated = entry.dateCreated;
  compacted.dateRead = entry.dateRead;
  compacted.feed = entry.feed;
  compacted.id = entry.id;
  compacted.readState = entry.readState;
  compacted.urls = entry.urls;
  compacted.archiveState = ENTRY_STATE_ARCHIVED;
  compacted.dateArchived = archiveDate;
  return compacted;
}

function broadcastArchiveMessage(entries) {
  if(!entries.length) {
    return;
  }
  const ids = new Array(entries.length);
  for(let entry of entries) {
    ids.push(entry.id);
  }
  const archiveMessage = {};
  archiveMessage.type = 'archivedEntries';
  archiveMessage.ids = ids;

  const dbChannel = new BroadcastChannel('db');
  dbChannel.postMessage(archiveMessage);
  dbChannel.close();
}

this.archiveEntries = archiveEntries;
this.commandArchiveEntries = commandArchiveEntries;

} // End file block scope
