// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Thirty dates in ms
const expires = 1000 * 60 * 60 * 24 * 30;

// Deletes expired entries from the favicon cache
// TODO: declare a context to track num_deleted
function compact_favicons() {
  console.log('Compacting favicon-cache');
  favicon_connect(connect_onsuccess, connect_onerror);
}

function connect_onerror(event) {
  console.error(event.target.error);
}

function connect_onsuccess(event) {
  const db = event.target.result;
  favicon_open_rw_cursor(db, open_cursor_onsuccess, open_cursor_onerror);
}

function open_cursor_onerror(event) {
  console.error(event.target.error);
  on_complete();
}

function open_cursor_onsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    on_complete();
    return;
  }

  const entry = cursor.value;
  if(is_favicon_entry_expired(entry, expires)) {
    console.debug('Deleting favicon entry', entry.pageURLString);
    cursor.delete();
  }

  cursor.continue();
}

// TODO: close connection
function on_complete() {
  console.log('Finished compacting favicon-cache');
}

this.compact_favicons = compact_favicons;

} // End file block scope
