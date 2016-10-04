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

// Searches the entry store for entries that contain at least one of the urls
// and then calls back with an array of matching entries.
// The callback function's context is not rebound.
// Input urls are not validated. Duplicate urls will be searched twice. Invalid
// urls cause an uncaught exception.
// Input urls are normalized.
function FindEntryTask() {
  this.log = new LoggingService();
  this.normalizeEntryURL = rdr.entry.normalizeURL;
}

FindEntryTask.prototype.start = function(db, urls, matchLimit, callback) {
  if(!urls.length) {
    throw new Error('at least one url is required');
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
    const normalizedURLString = this.normalizeEntryURL(url);
    const request = index.openCursor(normalizedURLString);
    request.onsuccess = this._openCursorOnSuccess.bind(this, ctx);
    request.onerror = this._openCursorOnError.bind(this, ctx);
  }
};

FindEntryTask.prototype._openCursorOnSuccess = function(ctx, event) {
  // Before processing, check if a limit was reached. The limit may have been
  // reached by another cursor because urls are processed concurrently. If
  // already reached then do nothing. This will always be false in the case of
  // an unspecified limit.
  if(ctx.reachedMatchLimit) {
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
    ctx.numURLsProcessed++;

    // Now check if we finished processing all urls. This will be true for the
    // first time if the current url is the last url to resolve its lookup
    if(ctx.numURLsProcessed >= ctx.numURLs) {
      this._onComplete(ctx);
    }

    // We are finished with the current url, and we may also be finished with
    // all urls, so exit.
    return;
  }

  // If we have not reached the limit, and there was a matching entry, append it
  // TODO: avoid appending duplicates by checking matches does not contain entry
  const entry = cursor.value;
  ctx.matches.push(entry);

  // If a limit was provided, and the append resulted in reaching the limit,
  // then we are done
  if(ctx.matchLimit && ctx.matches.length >= ctx.matchLimit) {
    // Let any future success event handlers know to stop advancing
    ctx.reachedMatchLimit = true;
    this._onComplete(ctx);
    return;
  }

  cursor.continue();
};

FindEntryTask.prototype._openCursorOnError = function(ctx, event) {
  this.log.error(event.target.error);
  ctx.numURLsProcessed++;
  if(!ctx.reachedMatchLimit && ctx.numURLsProcessed >= ctx.numURLs) {
    this._onComplete(ctx);
  }
};

FindEntryTask.prototype._onComplete = function(ctx) {
  if(ctx.didCallback) {
    throw new Error('duplicated callback');
  }

  ctx.didCallback = true;
  ctx.callback(ctx.matches);
};
