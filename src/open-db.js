// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const name = 'reader';
const version = 20;

function openDB(callback) {
  const request = indexedDB.open(name, version);
  request.onupgradeneeded = upgrade;
  request.onsuccess = onSuccess.bind(request, callback);
  request.onerror = onError.bind(request, callback);
  request.onblocked = onBlocked.bind(request, callback);
}

function onSuccess(callback, event) {
  callback(event.target.result);
}

function onError(callback, event) {
  console.error(event);
  callback();
}

function onBlocked(callback, event) {
  console.warn(event);
  callback();
}

function upgrade(event) {
  console.log('Upgrading database %s from version', name, event.oldVersion);

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
}

var rdr = rdr || {};
rdr.openDB = openDB;

} // End file block scope
