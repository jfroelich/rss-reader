// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Thirty dates in ms
const expires = 1000 * 60 * 60 * 24 * 30;

// Deletes expired entries from the favicon cache
// TODO: declare a context to track num_deleted
function compactFavicons() {
  console.log('Compacting favicon-cache');
  faviconConnect(connectOnsuccess, connectOnerror);
}

function connectOnerror(event) {
  console.error(event.target.error);
}

function connectOnsuccess(event) {
  const db = event.target.result;
  faviconOpenRWCursor(db, openCursorOnsuccess, openCursorOnerror);
}

function openCursorOnerror(event) {
  console.error(event.target.error);
  onComplete();
}

function openCursorOnsuccess(event) {
  const cursor = event.target.result;
  if(!cursor) {
    onComplete();
    return;
  }

  const entry = cursor.value;
  if(isFaviconEntryExpired(entry, expires)) {
    console.debug('Deleting favicon entry', entry.pageURLString);
    cursor.delete();
  }

  cursor.continue();
}

// TODO: close connection
function onComplete() {
  console.log('Finished compacting favicon-cache');
}

this.compactFavicons = compactFavicons;

} // End file block scope
