// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Searches the entry store for entries that contain at least one of the urls
// and then calls back with an array of matching entries.
// The callback function's context is not rebound.
// Input urls are not validated. Duplicate urls will be searched twice. Invalid
// syntax causes an uncaught exception.
// Input urls are normalized.
// @param db {IDBDatabase} an open database connection
// @param urls {Array} an array of url strings to search with
// @param callback {function} a callback function
function findEntriesByURLs(db, urls, matchLimit, callback) {
  const context = {};
  context.didCallback = false;
  context.matches = [];
  context.numURLs = urls.length;
  context.callback = callback;
  context.numURLsProcessed = 0;
  context.reachedMatchLimit = false;
  if(matchLimit) {
    console.assert(isFinite(matchLimit));
    console.assert(matchLimit > 0);
    context.matchLimit = matchLimit;
  }

  // TODO: this should never be called with an empty array, so maybe this
  // should be an assert instead?
  // We have to callback, contractually, in the event of this error, I think.
  // Because otherwise this never calls back. If this were to just be an assert,
  // it would have to be a fatal one, perhaps by throwing an exception
  if(!urls.length) {
    console.warn('No urls');
    callback(context.matches);
    return;
  }

  const tx = db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('urls');
  for(let url of urls) {
    const normalizedURLString = normalizeEntryURLString(url);
    const request = index.openCursor(normalizedURLString);
    request.onsuccess = openCursorOnSuccess.bind(context);
    request.onerror = openCursorOnError.bind(context);
  }
}

function openCursorOnSuccess(event) {
  // Before processing, check if a limit was reached. The limit may have been
  // reached by another cursor because urls are processed concurrently. If
  // already reached then do nothing. This will always be false in the case of
  // an unspecified limit.
  if(this.reachedMatchLimit) {
    return;
  }

  const cursor = event.target.result;
  if(!cursor) {
    this.numURLsProcessed++;
    if(this.numURLsProcessed >= this.numURLs) {
      onComplete.call(this);
    }

    return;
  }

  // Append the matching entry
  // TODO: avoid duplicates by checking matches does not contain entry
  const entry = cursor.value;
  this.matches.push(entry);
  if(this.matchLimit && this.matches.length >= this.matchLimit) {
    this.reachedMatchLimit = true;
    onComplete.call(this);
    return;
  }

  cursor.continue();
}

function openCursorOnError(event) {
  console.error(event.target.error);
  this.numURLsProcessed++;
  if(!this.reachedMatchLimit && this.numURLsProcessed === this.numURLs) {
    onComplete.call(this);
  }
}

function onComplete() {
  if(this.didCallback) {
    console.error('Duplicate callback!');
    return;
  }

  this.didCallback = true;
  this.callback(this.matches);
}

this.findEntriesByURLs = findEntriesByURLs;

} // End file block scope
