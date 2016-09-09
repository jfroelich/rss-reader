// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: rename file to mark-entry-as-read.js

function markEntryAsRead(entryId, callback) {
  console.assert(!isNaN(entryId));
  console.assert(isFinite(entryId));
  console.assert(entryId > 0);
  const context = {'entryId': entryId, 'callback': callback};
  openDB(onOpenDB.bind(context));
}

function onOpenDB(db) {
  if(!db) {
    onComplete.call(this, 'ConnectionError');
    return;
  }

  this.db = db;
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(this.entryId);
  request.onsuccess = openCursorOnsuccess.bind(this);
  request.onerror = openCursorOnerror.bind(this);
}

function openCursorOnsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    console.error('No entry found', this.entryId);
    onComplete.call(this, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === ENTRY_FLAGS.READ) {
    console.error('Already read entry', this.entryId);
    onComplete.call(this, 'AlreadyReadError');
    return;
  }

  entry.readState = ENTRY_FLAGS.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;

  // Async. Request an update on the same readwrite transaction, and do not
  // wait for it to complete.
  cursor.update(entry);

  // Async. This call is implicitly blocked by the readwrite transaction used
  // here, so the count of unread will be affected, even though we do not
  // wait for cursor.update to complete.
  updateBadge(this.db);
  onComplete.call(this, 'Success');
}

function openCursorOnerror(event) {
  console.warn(event.target.error);
  onComplete.call(this, 'CursorError');
}

function onComplete(eventType) {
  if(this.db) {
    this.db.close();
  }

  if(this.callback) {
    this.callback({
      'type': eventType,
      'entryId': this.entryId
    });
  }
}

this.markEntryAsRead = markEntryAsRead;

} // End file block scope
