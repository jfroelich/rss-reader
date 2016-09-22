// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.db = {};

rdr.db.name = 'reader';
rdr.db.version = 20;

rdr.db.open = function(callback) {
  const request = indexedDB.open(rdr.db.name, rdr.db.version);
  request.onupgradeneeded = rdr.db._onUpgradeNeeded;
  request.onsuccess = rdr.db._onSuccess.bind(request, callback);
  request.onerror = rdr.db._onError.bind(request, callback);
  request.onblocked = rdr.db._onBlocked.bind(request, callback);
};

rdr.db._onSuccess = function(callback, event) {
  callback(event.target.result);
};

rdr.db._onError = function(callback, event) {
  console.error(event);
  callback();
};

rdr.db._onBlocked = function(callback, event) {
  console.warn(event);
  callback();
};

rdr.db._onUpgradeNeeded = function(event) {
  console.log('Upgrading database %s from rdr.db.version', rdr.db.name,
    event.oldVersion);

  const request = event.target;
  const connection = request.result;
  let feedStore = null, entryStore = null;
  const stores = connection.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = request.transaction.objectStore('feed');
  } else {
    feedStore = connection.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  if(stores.contains('entry')) {
    entryStore = request.transaction.objectStore('entry');
  } else {
    entryStore = connection.createObjectStore('entry', {
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
