// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const tenDaysMillis = 10 * 24 * 60 * 60 * 1000;

// Iterates over entries in storage and archives older entries
this.archive_entries = function(expiresAfterMillis) {
  console.log('Archiving entries...');

  if(typeof expiresAfterMillis !== 'undefined') {
    console.assert(!isNaN(expiresAfterMillis), 'expires is nan');
    console.assert(isFinite(expiresAfterMillis), 'expires not finite');
    console.assert(expiresAfterMillis > 0, 'expires is negative');
  }

  const context = {
    'expiresAfterMillis': tenDaysMillis,
    'num_processed': 0,
    'num_changed': 0,
    'currentDate': new Date()
  };

  if(typeof expiresAfterMillis === 'number') {
    context.expiresAfterMillis = expiresAfterMillis;
  }

  open_db(on_open_db.bind(context));
};

function on_open_db(connection) {
  if(!connection) {
    on_complete.call(this);
    return;
  }

  this.connection = connection;
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = open_cursor_onsuccess.bind(this);
  request.onerror = open_cursor_onerror.bind(this);
}

function open_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    on_complete.call(this);
    return;
  }

  this.num_processed++;

  const entry = new Entry(cursor.value);
  console.assert(entry.dateCreated);
  console.assert(this.currentDate >= entry.dateCreated);
  const age = this.currentDate - entry.dateCreated;

  if(age > this.expiresAfterMillis) {
    const archived = entry.archive().serialize();
    console.debug('Archiving', entry.getURL().toString());
    cursor.update(archived);
    send_message(entry.id);
    this.num_changed++;
  }

  cursor.continue();
}

function open_cursor_onerror(event) {
  console.error(event.target.error);
  on_complete.call(this);
}

function send_message(entryId) {
  chrome.runtime.sendMessage({
    'type': 'archiveEntryRequested',
    'entryId': entryId
  });
}

function on_complete() {
  console.log('Archived %s of %s entries', this.num_changed,
    this.num_processed);
  if(this.connection) {
    this.connection.close();
  }
}

} // End file block scope
