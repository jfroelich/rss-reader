// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.entry = rdr.entry || {};
rdr.entry.archive = {};

// Ten days in ms
rdr.entry.archive.defaultExpiresMs = 10 * 24 * 60 * 60 * 1000;

// Iterates over entries that have not been archived and have been read, and
// archives entries that are older. Archiving shrinks the size of the stored
// entry object in the database.
// @param expires {number} an entry is archivable if older than this, in ms.
// If not set, a default value of 10 days in ms is used.
rdr.entry.archive.start = function(verbose, expires) {

  if(typeof verbose !== 'boolean') {
    throw new Error('verbose param must be boolean');
  }

  if(typeof expires !== 'undefined') {
    if(!Number.isInteger(expires) || expires < 1) {
      throw new Error('invalid expires param: ' + expires);
    }
  }

  if(verbose) {
    console.log('Archiving entries...');
  }

  rdr.db.open(rdr.entry.archive._onOpenDB.bind({
    'expires': expires || rdr.entry.archive.defaultExpiresMs,
    'numEntriesProcessed': 0,
    'numEntriesModified': 0,
    'currentDate': new Date(),
    'verbose': verbose
  }));
};

rdr.entry.archive._onOpenDB = function(db) {
  if(!db) {
    if(this.verbose) {
      console.error('Failed to connect to db');
    }

    rdr.entry.archive._onComplete.call(this);
    return;
  }

  this.db = db;
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [rdr.entry.flags.UNARCHIVED, rdr.entry.flags.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = rdr.entry.archive._openCursorOnSuccess.bind(this);
  request.onerror = rdr.entry.archive._openCursorOnError.bind(this);
};

rdr.entry.archive._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    rdr.entry.archive._onComplete.call(this);
    return;
  }

  this.numEntriesProcessed++;
  const entry = cursor.value;

  // Skip entries without a date created
  if(!entry.dateCreated) {
    cursor.continue();
    return;
  }

  const entryAgeInMs = this.currentDate - entry.dateCreated;

  // Skip entries created in the future
  if(entryAgeInMs < 0) {
    cursor.continue();
    return;
  }

  if(entryAgeInMs > this.expires) {
    if(this.verbose) {
      console.debug('Archiving', rdr.entry.getURL(entry));
    }
    this.numEntriesModified++;
    cursor.update(rdr.entry.archive.asArchivable(entry));
    chrome.runtime.sendMessage({'type': 'archiveEntryPending', 'id': entry.id});
  }

  cursor.continue();
};

// Rather than filter fields, set fields of interest in a new object.
rdr.entry.archive.asArchivable = function(inputEntry) {
  const outputEntry = {};
  outputEntry.archiveState = rdr.entry.flags.ARCHIVED;
  outputEntry.dateArchived = new Date(); // new field
  outputEntry.dateCreated = inputEntry.dateCreated;//impure
  if(inputEntry.dateRead) {
    outputEntry.dateRead = inputEntry.dateRead; // impure
  }
  outputEntry.feed = inputEntry.feed;
  outputEntry.id = inputEntry.id;
  outputEntry.readState = inputEntry.readState;
  outputEntry.urls = inputEntry.urls;// doubly impure
  return outputEntry;
};

rdr.entry.archive._openCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.entry.archive._onComplete.call(this);
};

rdr.entry.archive._onComplete = function() {
  if(this.verbose) {
    console.log('Visited %s entries', this.numEntriesProcessed);
    console.log('Archived %s entries', this.numEntriesModified);
  }

  if(this.db) {
    this.db.close();
  }
};
