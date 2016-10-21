// See license.md

'use strict';

// TODO: merge with feed-cache
// TODO: revert upgrade to using a version migration approach
// TODO: just use global functions, no need for class

function FeedDb(log) {
  this.name = 'reader';
  this.version = 20;
  this.log = log || SilentConsole;
}

FeedDb.prototype.connect = function(onSuccess, onError) {
  this.log.log('Connecting to database', this.name, this.version);

  const request = indexedDB.open(this.name, this.version);
  const context = {'was_blocked': false};
  request.onupgradeneeded = this._upgrade.bind(this, context);
  request.onsuccess = function(event) {
    if(!context.was_blocked)
      onSuccess(event.target.result);
  };
  request.onerror = function(event) {
    this.log.debug(event.target.error);
    onError();
  };

  request.onblocked = function(event) {
    this.log.debug(event.target.error);
    context.was_blocked = true;
    onError();
  };
};

FeedDb.prototype._upgrade = function(context, event) {

  // Treat a prior block event as an error
  // See http://stackoverflow.com/questions/40032008
  if(context.was_blocked) {
    event.target.transaction.abort();
    return;
  }

  // TODO: access name from conn
  this.log.log('Upgrading database %s to version %s from version', this.name,
    this.version, event.oldVersion);

  const request = event.target;
  const db = request.result;
  let feed_store = null, entry_store = null;
  const stores = db.objectStoreNames;

  if(stores.contains('feed')) {
    feed_store = request.transaction.objectStore('feed');
  } else {
    feed_store = db.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  if(stores.contains('entry')) {
    entry_store = request.transaction.objectStore('entry');
  } else {
    entry_store = db.createObjectStore('entry', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const feed_indices = feed_store.indexNames;
  const entry_indices = entry_store.indexNames;

  // Deprecated
  if(feed_indices.contains('schemeless'))
    feed_store.deleteIndex('schemeless');
  // Deprecated. Use the new urls index
  if(feed_indices.contains('url'))
    feed_store.deleteIndex('url');

  // Create a multi-entry index using the new urls property, which should
  // be an array of unique strings of normalized urls
  if(!feed_indices.contains('urls'))
    feed_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });

  // TODO: deprecate this, have the caller manually sort and stop requiring
  // title, this just makes it difficult.
  if(!feed_indices.contains('title'))
    feed_store.createIndex('title', 'title');

  // Deprecated
  if(entry_indices.contains('unread'))
    entry_store.deleteIndex('unread');

  // For example, used to count the number of unread entries
  if(!entry_indices.contains('readState'))
    entry_store.createIndex('readState', 'readState');

  if(!entry_indices.contains('feed'))
    entry_store.createIndex('feed', 'feed');

  if(!entry_indices.contains('archiveState-readState'))
    entry_store.createIndex('archiveState-readState',
      ['archiveState', 'readState']);

  // Deprecated. Use the urls index instead.
  if(entry_indices.contains('link'))
    entry_store.deleteIndex('link');

  // Deprecated. Use the urls index instead.
  if(entry_indices.contains('hash'))
    entry_store.deleteIndex('hash');

  if(!entry_indices.contains('urls'))
    entry_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
};

// TODO: deprecate, caller can do this, this is superfluous
// Requests the database to eventually be deleted, returns the request object
FeedDb.prototype.delete = function() {
  this.log.log('Deleting database', this.name);
  return indexedDB.deleteDatabase(this.name);
};
