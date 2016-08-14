// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const tenDaysMillis = 10 * 24 * 60 * 60 * 1000;

// The sole exported function of this file. Iterates over entries in storage
// and archived any expired entries.
this.archiveEntries = function(expiresAfterMillis) {
  console.log('Archiving entries...');

  if(expiresAfterMillis) {
    console.assert(!isNaN(expiresAfterMillis), 'expires is nan');
    console.assert(expiresAfterMillis > 0, 'expires is negative');
  }

  const context = {
    'expiresAfterMillis': expiresAfterMillis || tenDaysMillis,
    'numEntriesProcessed': 0,
    'numEntriesChanged': 0,
    'currentDate': new Date()
  };

  Database.open(onOpenDatabase.bind(context));
};

function onOpenDatabase(connection) {
  if(!connection) {
    onComplete.call(this);
    return;
  }

  // Open a cursor over entries that are read and unarchived
  this.connection = connection;
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = openCursorOnSuccess.bind(this);
  request.onerror = openCursorOnError.bind(this);
}

function openCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    onComplete.call(this);
    return;
  }

  this.numEntriesProcessed++;

  // TODO: deserialize entries on load. Blocked on proper implementation
  // of Entry constructor (deserializing urls)

  const entry = cursor.value;
  const ageInMillis = getEntryAge.call(this, entry);
  if(ageInMillis > this.expiresAfterMillis) {
    console.debug('Archiving entry', Entry.prototype.getURL.call(entry));
    const archivedEntry = Entry.prototype.archive.call(entry);
    cursor.update(archivedEntry);
    sendMessage(archivedEntry.id);
    this.numEntriesChanged++;
  }
  cursor.continue();
}

function openCursorOnError(event) {
  console.error(event.target.error);
  onComplete.call(this);
}

function getEntryAge(entry) {
  let age = 0;
  if(entry.dateCreated) {
    console.assert(this.currentDate > entry.dateCreated, 'created in future');
    // Subtract the date to get the difference in milliseconds
    age = this.currentDate - entry.dateCreated;
  } else {
    // Use a fake age that guarantees archival
    console.warn('Faking date created', entry);
    age = this.expiresAfterMillis + 1;
  }
  return age;
}

function sendMessage(entryId) {
  chrome.runtime.sendMessage({
    'type': 'archiveEntryRequested',
    'entryId': entryId
  });
}

function onComplete() {
  if(this.connection) {
    this.connection.close();
  }

  console.log('Archive completed');

  if(this.numEntriesProcessed) {
    console.log('Archived %s of %s entries', this.numEntriesChanged,
      this.numEntriesProcessed);
  }
}

} // End file block scope
