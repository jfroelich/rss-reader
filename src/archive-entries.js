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

  if(typeof expiresAfterMillis !== 'undefined') {
    console.assert(!isNaN(expiresAfterMillis), 'expires is nan');
    console.assert(isFinite(expiresAfterMillis), 'expires not finite');
    console.assert(expiresAfterMillis > 0, 'expires is negative');
  }

  const context = {
    'expiresAfterMillis': tenDaysMillis,
    'numEntriesProcessed': 0,
    'numEntriesChanged': 0,
    'currentDate': new Date()
  };

  if(typeof expiresAfterMillis === 'number') {
    context.expiresAfterMillis = expiresAfterMillis;
  }

  Database.open(onOpenDatabase.bind(context));
};

function onOpenDatabase(connection) {
  if(!connection) {
    onComplete.call(this);
    return;
  }

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

  const entry = new Entry(cursor.value);
  console.assert(entry.dateCreated, 'missing date created');
  console.assert(this.currentDate >= entry.dateCreated, 'created in future');
  const age = this.currentDate - entry.dateCreated;

  if(age > this.expiresAfterMillis) {
    const archived = entry.archive().serialize();
    console.debug('Storing', archived);
    cursor.update(archived);
    sendArchiveRequestedMessage(entry.id);
    this.numEntriesChanged++;
  }

  cursor.continue();
}

function openCursorOnError(event) {
  console.error(event.target.error);
  onComplete.call(this);
}

function sendArchiveRequestedMessage(entryId) {
  chrome.runtime.sendMessage({
    'type': 'archiveEntryRequested',
    'entryId': entryId
  });
}

function onComplete() {
  console.log('Archived %s of %s entries', this.numEntriesChanged,
    this.numEntriesProcessed);

  if(this.connection) {
    this.connection.close();
  }
}

} // End file block scope
