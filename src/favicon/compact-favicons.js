// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: avoid DRY. This has to also connect to the same database as lookup,
// but I am hardcoding the variables like database name and table names

// Deletes expired entries from the favicon cache
this.compact_favicons = function() {
  console.log('Compacting favicon-cache');
  // TODO: declare a context to track num_deleted

  const request = indexedDB.open('favicon-cache', 1);
  request.onsuccess = open_db_onsuccess;
  request.onerror = open_db_onerror;
  request.onblocked = open_db_onblocked;
};

function open_db_onerror(event) {
  console.error(event.target.error);
}

function open_db_onblocked(event) {
  console.error(event.target.error);
}

function open_db_onsuccess(event) {
  const db = event.target.result;
  const transaction = db.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = open_cursor_onsuccess;
  request.onerror = open_cursor_onerror;
}

function open_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    // no entries or all entries iterated
    // TODO: close connection
    console.log('Finished compacting favicon-cache');
    return;
  }

  const entry = cursor.value;

  // If expired, delete
  // TODO: this should be shared with lookup_favicon somehow, not duplicated
  // Maybe via an external parameter? It doesn't need to be the same value but
  // it should be called in a similar way, and should also share the logic
  // of is_expired
  // TODO: should be creating one date for the call to compact,
  // not a new date per cursor callback
  const expires_after_ms = 1000 * 60 * 60 * 24 * 30;
  const age = new Date() - entry.dateUpdated;
  if(age >= expires_after_ms) {
    console.debug('Deleting favicon entry', entry);
    cursor.delete();
  }

  cursor.continue();
}

function open_cursor_onerror(event) {
  // TODO: close the database connection, need to get it from the event
  console.error(event.target.error);
}

} // End file block scope
