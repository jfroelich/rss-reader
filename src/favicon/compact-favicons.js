// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Thirty dates in ms
const expires = 1000 * 60 * 60 * 24 * 30;

// Deletes expired entries from the favicon cache
function compact() {
  console.log('Compacting favicon cache');
  rdr.faviconCache.connect(connectOnsuccess, connectOnerror);
}

function connectOnerror(event) {
  console.error(event.target.error);
}

function connectOnsuccess(event) {
  const db = event.target.result;
  rdr.faviconCache.openCursor(db, openCursorOnsuccess, openCursorOnerror);
}

function openCursorOnerror(event) {
  console.error(event.target.error);
  onComplete();
}

function openCursorOnsuccess(event) {
  const isEntryExpired = rdr.favicon.isEntryExpired;
  const cursor = event.target.result;
  if(!cursor) {
    onComplete();
    return;
  }

  const entry = cursor.value;
  if(isEntryExpired(entry, expires)) {
    cursor.delete();
  }

  cursor.continue();
}

function onComplete() {
  console.log('Finished compacting favicon cache');
}

var rdr = rdr || {};
rdr.favicon = rdr.favicon || {};
rdr.favicon.compact = compact;

} // End file block scope
