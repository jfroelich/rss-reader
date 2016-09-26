// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: rename to exists.js, create rdr.entry.exists function that checks
// whether an entry exists for a given set of urls
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

var rdr = rdr || {};
rdr.entry = rdr.entry || {};

// Searches the entry store for entries that contain at least one of the urls
// and then calls back with an array of matching entries.
// The callback function's context is not rebound.
// Input urls are not validated. Duplicate urls will be searched twice. Invalid
// urls cause an uncaught exception.
// Input urls are normalized.
// @param db {IDBDatabase} an open database connection
// @param urls {Array} an array of url strings to search with
// @param callback {function} a callback function
rdr.entry.findByURLs = function(db, urls, matchLimit, callback) {
  if(!urls.length) {
    throw new Error('at least one url is required');
  }

  if(typeof matchLimit === 'number') {
    if(!Number.isInteger(matchLimit) || matchLimit < 1) {
      throw new TypeError('invalid matchLimit param: ' + matchLimit);
    }
  }

  const ctx = {};
  ctx.didCallback = false;
  ctx.matches = [];
  ctx.numURLs = urls.length;
  ctx.callback = callback;
  ctx.numURLsProcessed = 0;
  ctx.matchLimit = matchLimit || 0;
  ctx.reachedMatchLimit = false;

  const tx = db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('urls');
  for(let url of urls) {
    const normalizedURLString = rdr.entry.normalizeURL(url);
    const request = index.openCursor(normalizedURLString);
    request.onsuccess = rdr.entry._findOpenCursorOnSuccess.bind(ctx);
    request.onerror = rdr.entry._findOpenCursorOnError.bind(ctx);
  }
};

rdr.entry._findOpenCursorOnSuccess = function(event) {
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
      rdr.entry._findOnComplete.call(this);
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
    rdr.entry._findOnComplete.call(this);
    return;
  }

  cursor.continue();
};

rdr.entry._findOpenCursorOnError = function(event) {
  console.error(event.target.error);
  this.numURLsProcessed++;
  if(!this.reachedMatchLimit && this.numURLsProcessed >= this.numURLs) {
    rdr.entry._findOnComplete.call(this);
  }
};

rdr.entry._findOnComplete = function() {
  if(this.didCallback) {
    throw new Error('duplicated callback');
  }

  this.didCallback = true;
  this.callback(this.matches);
};
