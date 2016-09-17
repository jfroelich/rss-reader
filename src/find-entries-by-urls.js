// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: profiling shows this is one of the slowest functions of the
// backend polling process. It is probably the length of time it takes to do
// the index lookup. Maybe there is a way to speed it up. Maybe part of the
// issue is that I am deserializing entries, and it would be faster to use
// a keyed cursor and just return entry ids. After all, I know that the one
// calling context where this function is called is in polling, and that is
// just to check if an entry exists. If I use a keyCursor then maybe idb is
// smart enough to skip the deserialization of the full entry.


// TODO: it doesn't actually make sense to always lookup all urls here.
// Right now I merely stop appending matches, but I still continue to perform
// all lookups. It would be better to not even continue to do lookups if I
// reached the limit. Therefore I shouldn't be using a for loop. I should be
// using continuation calling to reach the end, and at each async step,
// deciding whether to do the next step or end. It is all serial in the end,
// because even though the lookups are async, I don't think there is any
// performance benefit to doing them in parallel. If all entries are going
// to be iterated, then the same amount of work has to occur.

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

  // The urls parameter should be a defined array and it should never be empty
  console.assert(urls.length);

  const context = {};
  context.didCallback = false;
  context.matches = [];
  context.numURLs = urls.length;
  context.callback = callback;
  context.numURLsProcessed = 0;
  context.reachedMatchLimit = false;

  if(matchLimit) {
    // If matchLimit is defined, it should be a finite positive integer
    console.assert(isFinite(matchLimit));
    console.assert(matchLimit > 0);
    context.matchLimit = matchLimit;
  }

  const tx = db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('urls');
  for(let url of urls) {
    const normalizedURLString = rdr.entry.normalizeURL(url);
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

    // Only call oncomplete if all urls processed. If there was no cursor,
    // this means there were no matching entries for the current url index
    // lookup, or we advanced the cursor past the end of the matches.

    // Now that we have finished processing the url, increment. We can only
    // increment here because urls are processed concurrently, and because we
    // want to wait until we have iterated over all matching entries for one of
    // the input urls
    this.numURLsProcessed++;

    // Now check if we finished processing all urls. This will be true for the
    // first time if the current url is the last url to resolve its lookup
    if(this.numURLsProcessed >= this.numURLs) {
      onComplete.call(this);
    }

    // We are finished with the current url, and we may also be finished with
    // all urls, so exit.
    return;
  }

  // If we have not reached the limit, and there was a matching entry, append it
  // TODO: avoid appending duplicates by checking matches does not contain entry
  const entry = cursor.value;
  this.matches.push(entry);

  // If a limit was provided, and the append resulted in reaching the limit,
  // then we are done
  if(this.matchLimit && this.matches.length >= this.matchLimit) {
    // Let any future success event handlers know to stop advancing
    this.reachedMatchLimit = true;
    onComplete.call(this);
    return;
  }

  cursor.continue();
}

function openCursorOnError(event) {
  console.error(event.target.error);
  this.numURLsProcessed++;
  if(!this.reachedMatchLimit && this.numURLsProcessed >= this.numURLs) {
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

var rdr = rdr || {};
rdr.findEntriesByURLs = findEntriesByURLs;

} // End file block scope
