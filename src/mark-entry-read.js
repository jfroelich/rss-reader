// See license.md

'use strict';

{ // Begin file block scope

async function markEntryRead(conn, entryId, verbose) {
  assertValidEntryId(entryId);
  const entry = await findEntryById(conn, entryId);
  assertUnread(entry, entryId);
  changeEntryPropsToRead(entry);
  await overwriteEntryInDb(conn, entry);

  if(verbose) {
    console.log('Updated database with read entry with id', entryId);
  }

  updateBadgeText(conn, verbose);// intentionally not awaited
}

this.markEntryRead = markEntryRead;

function changeEntryPropsToRead(entry) {
  entry.readState = ENTRY_STATE_READ;
  const currentDate = new Date();
  entry.dateRead = currentDate;
  entry.dateUpdated = currentDate;
}

function assertValidEntryId(entryId) {
  if(!Number.isInteger(entryId) || entryId < 1) {
    throw new TypeError(`Invalid entry id ${entryId}`);
  }
}

function assertUnread(entry, entryId) {
  if(!entry) {
    throw new Error(`No entry found with id ${entryId}`);
  } else if(entry.readState === ENTRY_STATE_READ) {
    throw new Error(`Already read entry with id ${entryId}`);
  }
}


function findEntryById(conn, id) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function overwriteEntryInDb(conn, entry) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readwrite');
    const request = tx.objectStore('entry').put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

} // End file block scope
