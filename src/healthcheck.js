// See license.md

'use strict';

/*
TODO: divide this module into separate modules. design one module that scans
entries looking for errors

TODO: add check for entries missing dateCreated
TODO: add check for entries with dateCreated in future
TODO: the orphan check needs to be improved, it should also validate that
an entry's feed id points to a real feed. I need to load an array of feed
ids first, then walk entries and check for any entries that are missing a
feed id, or do not point to a feed id in the set of known feed ids
*/

const HealthCheck = {};

HealthCheck.start = function(log) {
  log = log || SilentConsole;
  log.debug('Starting healthcheck...');

  const ctx = {
    'log': log,
    'numOrphansDeleted': 0,
    'numEntriesMissingURLsDeleted': 0,
    'completedOrphanScan': false,
    'completedEntriesMissingURLsScan': false
  };
  const db = new FeedDb();
  db.connect(HealthCheck._openDBOnSuccess.bind(ctx),
    HealthCheck._openDBOnError.bind(ctx));
};

HealthCheck._openDBOnSuccess = function(conn) {
  this.log.debug('Connected to database');
  this.db = conn;
  HealthCheck.orphan.scan.call(this);
  HealthCheck.missurls.scan.call(this);
};

HealthCheck._openDBOnError = function() {
  this.completedOrphanScan = true;
  this.completedEntriesMissingURLsScan = true;
  HealthCheck._onComplete.call(this);
};

HealthCheck.orphan = {};

HealthCheck.orphan.scan = function() {
  this.log.debug('Scanning for orphaned entries...');
  const tx = this.db.transaction('entry', 'readwrite');
  tx.oncomplete = HealthCheck.orphan._onComplete.bind(this);
  const store = tx.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = HealthCheck.orphan._openCursorOnSuccess.bind(this);
  request.onerror = HealthCheck.orphan._openCursorOnError.bind(this);
};

HealthCheck.orphan._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  const entry = cursor.value;

  // An entry without a feed id is an orphan
  if(!entry.feed) {
    this.log.debug('Deleting orphaned entry:', entry);
    this.numOrphansDeleted++;
    cursor.delete();
  }

  cursor.continue();
};

HealthCheck.orphan._openCursorOnError = function(event) {
  this.log.error(event.target.error);
  HealthCheck.orphan._onComplete.call(this);
};

HealthCheck.orphan._onComplete = function(event) {
  this.log.debug('Completed orphan scan');
  this.log.debug('Deleted %s orphaned entries', this.numOrphansDeleted);
  this.completedOrphanScan = true;
  HealthCheck._onComplete.call(this);
};

HealthCheck.missurls = {};

HealthCheck.missurls.scan = function() {
  this.log.debug('Scanning for entries missing urls...');
  const tx = this.db.transaction('entry', 'readwrite');
  tx.oncomplete = HealthCheck.missurls._onComplete.bind(this);
  const store = tx.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = HealthCheck.missurls._openCursorOnSuccess.bind(this);
  request.onerror = HealthCheck.missurls._openCursorOnError.bind(this);
};

HealthCheck.missurls._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  const entry = cursor.value;
  if(!entry.urls || !entry.urls.length) {
    this.log.debug('Deleting entry without urls:', entry);
    this.numEntriesMissingURLsDeleted++;
    cursor.delete();
  }
  cursor.continue();
};

HealthCheck.missurls._openCursorOnError = function(event) {
  this.log.error(event.target.error);
  HealthCheck.missurls._onComplete.call(this);
};

HealthCheck.missurls._onComplete = function(event) {
  this.log.debug('Completed scan for entries missing urls');
  this.log.debug('Deleted %s entries missing urls',
    this.numEntriesMissingURLsDeleted);
  this.completedEntriesMissingURLsScan = true;
  HealthCheck._onComplete.call(this);
};

HealthCheck._onComplete = function(event) {
  // _onComplete is called when each of the separate checks completes, but the
  // overall process is not complete until every check completes. If any of the
  // checks are incomplete then exit.
  if(!this.completedOrphanScan) {
    return;
  }

  if(!this.completedEntriesMissingURLsScan) {
    return;
  }

  if(this.db) {
    this.log.debug('Requesting database connection to be closed');
    this.db.close();
  }

  this.log.debug('Completed health check');
};
