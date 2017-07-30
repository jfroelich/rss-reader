// See license.md
'use strict';

{ // Begin file block scope

// Run archiveEntries from the command line with default parameters
async function commandArchiveEntries() {
  let maxAgeMillis;
  const verbose = true;
  let numArchived = 0;
  let conn;
  try {
    conn = await openReaderDb();
    numArchived = await archiveEntries(maxAgeMillis, verbose);
  } finally {
    if(conn) {
      conn.close();
    }
  }
  return numArchived;
}

// Scans the database and compacts entries that have been read
// @param maxAgeMillis {Number} how long before an entry is considered
// archivable
// @param verbose {Boolean} whether to log messages to console
// @returns {Number} the number of archived entries
async function archiveEntries(maxAgeMillis, verbose) {
  if(typeof maxAgeMillis === 'undefined') {
    maxAgeMillis = 1 * 24 * 60 * 60 * 1000;
  }

  validateMaxAgeInMillis(maxAgeMillis);
  if(verbose) {
    console.log('Archiving entries older than %d ms', maxAgeMillis);
  }

  let conn;
  let compacts, entries;
  try {
    conn = await openReaderDb();
    entries = await loadUnarchivedReadEntriesFromDb(conn);
    const archivableEntries = selectArchivableEntries(entries, maxAgeMillis);
    compacts = compactEntries(archivableEntries, verbose);
    await putEntriesInDb(conn, compacts);
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

// Throw errors if maxAgeMillis is invalid
function validateMaxAgeInMillis(maxAgeMillis) {
  if(!Number.isInteger(maxAgeMillis)) {
    throw new TypeError(`Invalid maxAgeMillis ${maxAgeMillis}`);
  } else if(maxAgeMillis < 0) {
    throw new TypeError(`Invalid maxAgeMillis ${maxAgeMillis}`);
  }
}

// Get all entries from the database as an array where entries are not
// archived and are read
// @param conn {IDBDatabase}
// @returns {Promise}
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

// Acts as an array filter. Returns a new array consisting of only entries
// that are archivable
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

// Acts as an array map. Returns a new array of entry objects where each
// entry has been compacted.
// @param entries {Array}
// @param verbose {Boolean}
function compactEntries(entries, verbose) {
  const currentDate = new Date();
  const compacts = [];
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

// Shallow copy certain properties into a new entry object
// @param entry {Object}
// @param archiveDate {Date}
// @returns {Object} the compacted entry
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

// @param conn {IDBDatabase}
// @param entries {Iterable}
// TODO: is there a putAll?
async function putEntriesInDb(conn, entries) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = [];
  const currentDate = new Date();
  for(let entry of entries) {
    entry.dateUpdated = currentDate;
    const promise = putEntry(tx, entry);
    promises.push(promise);
  }

  // Promise.all is failfast so this aborts if any one entry fails
  return await Promise.all(promises);
}

// Resolves when the entry has been stored to the result of the request
// If entry.id is not set this will result in adding
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


// Send a message to the "db" broadcast channel for each entry that was
// archived.
// @param entries {Iterable}
function broadcastArchiveMessage(entries) {
  if(entries.length) {
    const dbChannel = new BroadcastChannel('db');
    for(let entry of entries) {
      const message = {};
      message.type = 'archivedEntry';
      message.id = entry.id;
      dbChannel.postMessage(message);
    }
    dbChannel.close();
  }
}

// Export to global scope
this.archiveEntries = archiveEntries;
this.commandArchiveEntries = commandArchiveEntries;

} // End file block scope
