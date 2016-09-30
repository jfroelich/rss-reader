// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function EntryArchiveService() {
  this.sizeof = rdr.utils.sizeof;
  this.entryFlags = rdr.entry.flags;
  this.getEntryURL = rdr.entry.getURL;
  this.dbService = new FeedDbService();
  this.sendMessage = chrome.runtime.sendMessage;
  this.verbose = false;
  this.currentDate = new Date();
  this.maxAge = 10 * 24 * 60 * 60 * 1000;// 10 days in ms
  this.numEntriesProcessed = 0;
  this.numEntriesModified = 0;
  this.callback = null;
  this.shouldSendMessage = true;
}

// Scans the database for older entries and then archives them
EntryArchiveService.prototype.start = function() {
  if(!this.isMaxAgeValid()) {
    // TODO: use template literal?
    throw new Error('invalid maxAge ' + this.maxAge);
  }

  if(this.verbose) {
    console.log('Starting entry archive service, maxAge is', this.maxAge);
  }

  this.dbService.open(this._openDBOnSuccess.bind(this),
    this._openDBOnError.bind(this));
};

EntryArchiveService.prototype.isMaxAgeValid = function() {
  return typeof this.maxAge !== 'undefined' && Number.isInteger(this.maxAge) &&
    this.maxAge > 0;
};

EntryArchiveService.prototype._openDBOnSuccess = function(event) {
  const conn = event.target.result;
  const tx = conn.transaction('entry', 'readwrite');
  tx.oncomplete = this._onTxComplete.bind(this);
  const store = tx.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [this.entryFlags.UNARCHIVED, this.entryFlags.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = this._openCursorOnSuccess.bind(this);
  request.onerror = this._openCursorOnError.bind(this);
  conn.close(); // implicitly waits till tx completes
};

EntryArchiveService.prototype._openDBOnError = function(event) {
  console.error(event.target.error);
  this._onTxComplete();
};

EntryArchiveService.prototype._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  this.numEntriesProcessed++;
  const entry = cursor.value;

  if(!entry.dateCreated) {
    return cursor.continue();
  }

  // Age will be negative if the entry was somehow created in the future.
  // If age is negative then the following test always fails.
  const age = this.currentDate - entry.dateCreated;// in ms

  // An entry should be archived if its age is greater than maxAge. Otherwise,
  // ignore it.
  if(age <= this.maxAge) {
    return cursor.continue();
  }

  this.numEntriesModified++;
  const compactedEntry = this.compact(entry);

  if(this.verbose) {
    console.debug('Compacted %s (age %s, before %s, after %s)',
      this.getEntryURL(entry), age, this.sizeof(entry),
      this.sizeof(compactedEntry));
  }

  cursor.update(compactedEntry);

  if(this.shouldSendMessage) {
    const message = {'type': 'archiveEntryPending', 'id': entry.id};
    this.sendMessage(message);
  }

  cursor.continue();
};

EntryArchiveService.prototype._openCursorOnError = function(event) {
  console.error(event.target.error);
};

// This is impure
EntryArchiveService.prototype.compact = function(entry) {
  const output = {};
  output.archiveState = this.entryFlags.ARCHIVED;
  output.dateArchived = this.currentDate;
  output.dateCreated = entry.dateCreated;
  if(entry.dateRead) {
    output.dateRead = entry.dateRead;
  }
  output.feed = entry.feed;
  output.id = entry.id;
  output.readState = entry.readState;
  output.urls = entry.urls;
  return output;
};

EntryArchiveService.prototype._onTxComplete = function(event) {
  if(this.verbose) {
    console.log('Archive service completed (scanned %s, compacted %s)',
      this.numEntriesProcessed, this.numEntriesModified);
  }

  if(this.callback) {
    this.callback();
  }
};
