// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.healthcheck = {};

// TODO: it might be easier to just have an entryHealth scan that does all
// the various things to entries instead of a separate scan per problem
// I should do this before implementing the entry.dateCreated fixing
// TODO: add check for entries missing dateCreated
// TODO: add check for entries with dateCreated in future

// TODO: the orphan check needs to be improved, it should also validate that
// an entry's feed id points to a real feed. I need to load an array of feed
// ids first, then walk entries and check for any entries that are missing a
// feed id, or do not point to a feed id in the set of known feed ids

// Scans storage for issues and attempts to resolve them. This can be called
// from the console or run on a schedule.
// @param verbose {boolean} whether to log info to console
rdr.healthcheck.start = function(verbose) {

  if(verbose) {
    console.debug('Starting healthcheck...');
  }

  const ctx = {
    'verbose': verbose,
    'numOrphansDeleted': 0,
    'numEntriesMissingURLsDeleted': 0,
    'completedOrphanScan': false,
    'completedEntriesMissingURLsScan': false
  };
  const openDBTask = new OpenFeedDbTask();
  openDBTask.open(rdr.healthcheck._openDBOnSuccess.bind(ctx),
    rdr.healthcheck._openDBOnError.bind(ctx));
};

rdr.healthcheck._openDBOnSuccess = function(event) {
  if(this.verbose) {
    console.debug('Connected to database');
  }

  this.db = event.target.result;
  rdr.healthcheck.orphan.scan.call(this);
  rdr.healthcheck.missurls.scan.call(this);
};

rdr.healthcheck._openDBOnError = function(event) {
  console.error(event.target.error);
  this.completedOrphanScan = true;
  this.completedEntriesMissingURLsScan = true;
  rdr.healthcheck._onComplete.call(this);
};

rdr.healthcheck.orphan = {};

rdr.healthcheck.orphan.scan = function() {

  if(this.verbose) {
    console.debug('Scanning for orphaned entries...');
  }

  const tx = this.db.transaction('entry', 'readwrite');
  tx.oncomplete = rdr.healthcheck.orphan._onComplete.bind(this);
  const store = tx.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = rdr.healthcheck.orphan._openCursorOnSuccess.bind(this);
  request.onerror = rdr.healthcheck.orphan._openCursorOnError.bind(this);
};

rdr.healthcheck.orphan._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  const entry = cursor.value;

  // An entry without a feed id is an orphan
  if(!entry.feed) {
    if(this.verbose) {
      console.debug('Deleting orphaned entry:', entry);
    }

    this.numOrphansDeleted++;
    cursor.delete();
  }

  cursor.continue();
};

rdr.healthcheck.orphan._openCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.healthcheck.orphan._onComplete.call(this);
};

rdr.healthcheck.orphan._onComplete = function(event) {

  if(this.verbose) {
    console.debug('Completed orphan scan');
    console.debug('Deleted %s orphaned entries', this.numOrphansDeleted);
  }

  this.completedOrphanScan = true;
  rdr.healthcheck._onComplete.call(this);
};

rdr.healthcheck.missurls = {};

rdr.healthcheck.missurls.scan = function() {

  if(this.verbose) {
    console.debug('Scanning for entries missing urls...');
  }

  const tx = this.db.transaction('entry', 'readwrite');
  tx.oncomplete = rdr.healthcheck.missurls._onComplete.bind(this);
  const store = tx.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = rdr.healthcheck.missurls._openCursorOnSuccess.bind(this);
  request.onerror = rdr.healthcheck.missurls._openCursorOnError.bind(this);
};

rdr.healthcheck.missurls._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  const entry = cursor.value;
  if(!entry.urls || !entry.urls.length) {
    if(this.verbose) {
      console.debug('Deleting entry without urls:', entry);
    }
    this.numEntriesMissingURLsDeleted++;
    cursor.delete();
  }
  cursor.continue();
};

rdr.healthcheck.missurls._openCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.healthcheck.missurls._onComplete.call(this);
};

rdr.healthcheck.missurls._onComplete = function(event) {

  if(this.verbose) {
    console.debug('Completed scan for entries missing urls');
    console.debug('Deleted %s entries missing urls',
      this.numEntriesMissingURLsDeleted);
  }

  this.completedEntriesMissingURLsScan = true;
  rdr.healthcheck._onComplete.call(this);
};

rdr.healthcheck._onComplete = function(event) {
  // _onComplete is called when each of the separate checks completes, but the
  // overall process is not complete until every check completes. If any of the
  // checks are incomplete then exit.
  if(!this.completedOrphanScan) {
    return;
  }

  if(!this.completedEntriesMissingURLsScan) {
    return;
  }

  if(this.verbose) {
    console.debug('Completed health check');
  }

  if(this.db) {

    if(this.verbose) {
      console.debug('Requesting database connection to be closed');
    }

    this.db.close();
  }
};
