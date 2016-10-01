// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: think of a better name

function FeedDbService() {
  this.name = 'reader';
  this.version = 20;
  this.verbose = false;
}

FeedDbService.prototype.open = function(onSuccess, onError) {
  if(this.verbose) {
    console.log('Connecting to', this.name, 'version', this.version);
  }

  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this._upgrade.bind(this);
  request.onsuccess = onSuccess;
  request.onerror = onError;
  request.onblocked = onError;
};

FeedDbService.prototype._upgrade = function(event) {
  if(this.verbose) {
    console.log('Upgrading database %s to version %s from version', this.name,
      this.version, event.oldVersion);
  }

  const request = event.target;
  const db = request.result;
  let feedStore = null, entryStore = null;
  const stores = db.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = request.transaction.objectStore('feed');
  } else {
    feedStore = db.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  if(stores.contains('entry')) {
    entryStore = request.transaction.objectStore('entry');
  } else {
    entryStore = db.createObjectStore('entry', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const feedIndexNames = feedStore.indexNames;
  const entryIndexNames = entryStore.indexNames;

  // Deprecated
  if(feedIndexNames.contains('schemeless')) {
    feedStore.deleteIndex('schemeless');
  }

  // Deprecated. Use the new urls index
  if(feedIndexNames.contains('url')) {
    feedStore.deleteIndex('url');
  }

  // Create a multi-entry index using the new urls property, which should
  // be an array of unique strings of normalized urls
  if(!feedIndexNames.contains('urls')) {
    feedStore.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  }

  // TODO: deprecate this, have the caller manually sort and stop requiring
  // title, this just makes it difficult.
  if(!feedIndexNames.contains('title')) {
    feedStore.createIndex('title', 'title');
  }

  // Deprecated
  if(entryIndexNames.contains('unread')) {
    entryStore.deleteIndex('unread');
  }

  // For example, used to count the number of unread entries
  if(!entryIndexNames.contains('readState')) {
    entryStore.createIndex('readState', 'readState');
  }

  if(!entryIndexNames.contains('feed')) {
    entryStore.createIndex('feed', 'feed');
  }

  if(!entryIndexNames.contains('archiveState-readState')) {
    entryStore.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
  }

  // Deprecated. Use the urls index instead.
  if(entryIndexNames.contains('link')) {
    entryStore.deleteIndex('link');
  }

  // Deprecated. Use the urls index instead.
  if(entryIndexNames.contains('hash')) {
    entryStore.deleteIndex('hash');
  }

  if(!entryIndexNames.contains('urls')) {
    entryStore.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  }
};

// Requests the database to eventually be deleted, returns the request object
FeedDbService.prototype.delete = function() {

  if(this.verbose) {
    console.log('Deleting database', this.name);
  }

  return indexedDB.deleteDatabase(this.name);
};
