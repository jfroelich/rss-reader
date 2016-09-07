// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// TODO: this will be used by both compact and lookup
// - move lookup stuff that belongs here to here, and update lookup to use
// this instead
// - change compact to use this instead
// - export multiple individual functions, not a class
// - update script includes in UI files

const DB_NAME = 'favicon-cache';
const DB_VERSION = 1;

function connect(onsuccess, onerror) {
  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = upgrade;
  request.onsuccess = onsuccess;
  request.onerror = onerror;
  request.onblocked = onerror;
}

function upgrade(event) {
  // Unfinished
}

this.favicon_cache_connect = connect;

} // End file block scope
