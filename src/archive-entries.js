// See license.md

'use strict';

async function commandArchiveEntries() {
  let conn;
  let maxAge;// intentionally undefined
  try {
    conn = await dbConnect();
    const numArchived = await archiveEntries(conn, maxAge, true);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

{ // Begin file block scope

// @param conn {IDBDatabase} an open database connection
// @param options {Object} verbose (boolean), maxAgeInMillis {Number}
// @returns {Number} the new of archived entries
async function archiveEntries(conn, options) {

  options = options || {};
  const oneDayInMillis = 1 * 24 * 60 * 60 * 1000;
  const maxAgeInMillis = 'maxAgeInMillis' in options ?
    options.maxAgeInMillis : oneDayInMillis;
  const verbose = options.verbose;

  validateMaxAgeInMillis(maxAgeInMillis);
  if(verbose) {
    console.log('Archiving entries older than %d ms', maxAgeInMillis);
  }

  const entries = await getUnarchivedReadEntries(conn);
  const archivableEntries = selectArchivableEntries(entries, maxAgeInMillis);
  const compacts = compactEntries(archivableEntries, verbose);
  const putResolutions = await putEntriesInDb(conn, compacts);

  broadcastArchiveMessage(compacts);
  if(verbose) {
    console.log('Archive entries completed (loaded %d, compacted %d)',
      entries.length, compacts.length);
  }
  return compacts.length;
}

this.archiveEntries = archiveEntries;

function validateMaxAgeInMillis(maxAgeInMillis) {
  if(!Number.isInteger(maxAgeInMillis)) {
    throw new TypeError(`Invalid maxAgeInMillis ${maxAgeInMillis}`);
  } else if(maxAgeInMillis < 0) {
    throw new TypeError(`Invalid maxAgeInMillis ${maxAgeInMillis}`);
  }
}

function getUnarchivedReadEntries(conn) {
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

function selectArchivableEntries(entries, maxAgeInMillis) {
  const archivableEntries = [];
  const currentDate = new Date();
  for(let entry of entries) {
    const entryAgeInMillis = currentDate - entry.dateCreated;
    if(entryAgeInMillis > maxAgeInMillis) {
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

// TODO: consider imposing an upper bound on number of entry ids per message,
// or instead sending one message per entry and passing the buck to the
// browser
const broadcastArchiveMessage = function(entries) {
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
};

} // End file block scope
