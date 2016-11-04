// See license.md

'use strict';

/*
TODO: asyncify/promisify
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

HealthCheck.start = function(log = SilentConsole) {
  log.debug('Starting healthcheck...');

  const ctx = {
    'log': log,
    'num_orphans_deleted': 0,
    'num_entries_missing_urls_deleted': 0,
    'completed_orphan_scan': false,
    'completed_entries_missing_urls_scan': false
  };

  db_connect(undefined, undefined, log).then(
    HealthCheck._connect_on_success.bind(ctx)).catch(
      HealthCheck._connect_on_error.bind(ctx));
};

HealthCheck._connect_on_success = function(conn) {
  this.log.debug('Connected to database');
  this.conn = conn;
  HealthCheck.orphan.scan.call(this);
  HealthCheck.missurls.scan.call(this);
};

HealthCheck._connect_on_error = function(error) {
  this.completed_orphan_scan = true;
  this.completed_entries_missing_urls_scan = true;
  HealthCheck._on_complete.call(this);
};

HealthCheck.orphan = {};

HealthCheck.orphan.scan = function() {
  this.log.debug('Scanning for orphaned entries...');
  const tx = this.conn.transaction('entry', 'readwrite');
  tx.oncomplete = HealthCheck.orphan._on_complete.bind(this);
  const store = tx.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = HealthCheck.orphan._open_cursor_on_success.bind(this);
  request.onerror = HealthCheck.orphan._open_cursor_on_error.bind(this);
};

HealthCheck.orphan._open_cursor_on_success = function(event) {
  const cursor = event.target.result;
  if(!cursor)
    return;

  const entry = cursor.value;
  // An entry without a feed id is an orphan
  if(!entry.feed) {
    this.log.debug('Deleting orphaned entry:', entry);
    this.num_orphans_deleted++;
    cursor.delete();
  }

  cursor.continue();
};

HealthCheck.orphan._open_cursor_on_error = function(event) {
  this.log.error(event.target.error);
  HealthCheck.orphan._on_complete.call(this);
};

HealthCheck.orphan._on_complete = function(event) {
  this.log.debug('Completed orphan scan');
  this.log.debug('Deleted %s orphaned entries', this.num_orphans_deleted);
  this.completed_orphan_scan = true;
  HealthCheck._on_complete.call(this);
};

HealthCheck.missurls = {};

HealthCheck.missurls.scan = function() {
  this.log.debug('Scanning for entries missing urls...');
  const tx = this.conn.transaction('entry', 'readwrite');
  tx.oncomplete = HealthCheck.missurls._on_complete.bind(this);
  const store = tx.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = HealthCheck.missurls._open_cursor_on_success.bind(this);
  request.onerror = HealthCheck.missurls._open_cursor_on_error.bind(this);
};

HealthCheck.missurls._open_cursor_on_success = function(event) {
  const cursor = event.target.result;
  if(!cursor)
    return;

  const entry = cursor.value;
  if(!entry.urls || !entry.urls.length) {
    this.log.debug('Deleting entry without urls:', entry);
    this.num_entries_missing_urls_deleted++;
    cursor.delete();
  }
  cursor.continue();
};

HealthCheck.missurls._open_cursor_on_error = function(event) {
  this.log.error(event.target.error);
  HealthCheck.missurls._on_complete.call(this);
};

HealthCheck.missurls._on_complete = function(event) {
  this.log.debug('Completed scan for entries missing urls');
  this.log.debug('Deleted %s entries missing urls',
    this.num_entries_missing_urls_deleted);
  this.completed_entries_missing_urls_scan = true;
  HealthCheck._on_complete.call(this);
};

HealthCheck._on_complete = function(event) {
  // _on_complete is called when each of the separate checks completes, but the
  // overall process is not complete until every check completes. If any of the
  // checks are incomplete then exit.
  if(!this.completed_orphan_scan)
    return;

  if(!this.completed_entries_missing_urls_scan)
    return;

  if(this.conn) {
    this.log.debug('Requesting database connection to be closed');
    this.conn.close();
  }

  this.log.debug('Completed health check');
};
