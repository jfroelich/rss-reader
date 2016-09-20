// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.favicon = rdr.favicon || {};
rdr.favicon.compact = {};

// Deletes expired entries. Async.
// @param expires {Number} entry max age in ms
// @param versbose {boolean} if true, logs additional messages
rdr.favicon.compact.start = function(verbose, expires) {
  const context = {};
  context.verbose = verbose;
  if(typeof expires !== 'undefined') {
    console.assert(isFinite(expires));
    console.assert(expires > 0);
    context.expires = expires;
  } else {
    context.expires = rdr.favicon.cache.expires;
  }

  if(verbose) {
    console.log('Compacting favicon cache, max age:', context.expires);
  }

  rdr.favicon.cache.connect(
    rdr.favicon.compact._connectOnSuccess.bind(context),
    rdr.favicon.compact._connectOnError.bind(context));
};

rdr.favicon.compact._connectOnSuccess = function(event) {
  if(this.verbose) {
    console.debug('Connected to database');
  }

  this.db = event.target.result;
  rdr.favicon.cache.openCursor(this.db,
    rdr.favicon.compact._openCursorOnSuccess.bind(this),
    rdr.favicon.compact._openCursorOnError.bind(this));
};

rdr.favicon.compact._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    rdr.favicon.compact._onComplete.call(this);
    return;
  }

  const entry = cursor.value;

  if(this.verbose) {
    console.debug(new Date() - entry.dateUpdated, entry.pageURLString);
  }

  if(rdr.favicon.cache.isExpired(entry, this.expires)) {
    if(this.verbose) {
      console.debug('Deleting', entry.pageURLString);
    }
    cursor.delete();
  }

  cursor.continue();
};

rdr.favicon.compact._connectOnError = function(event) {
  console.error(event.target.error);
  rdr.favicon.compact._onComplete.call(this);
};

rdr.favicon.compact._openCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.favicon.compact._onComplete.call(this);
};

rdr.favicon.compact._onComplete = function() {
  if(this.db) {
    if(this.verbose) {
      console.debug('Requesting database be closed');
    }
    this.db.close();
  }

  if(this.verbose) {
    console.log('Finished compacting favicon cache');
  }
};
