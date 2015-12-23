// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// indexedDB lib
// TODO: just store scheme and schemeless props as parts of a url property.
// TODO: store urls as URL objects?

// TODO: rather than use a namespace object, this could simply be two
// global functions, openDatabase and upgradeDatabase, in two files?
// Or, it could just be one global function because nothing will ever call
// upgradeDatabase directly

'use strict';

const Database = {};

{ // BEGIN ANONYMOUS NAMESPACE

// TODO: use 'lucubrate' as the database name
const NAME = 'reader';
const VERSION = 17;

// Connects to indexedDB and passes the resulting event
// to the callback
Database.open = function(callback) {
  const request = indexedDB.open(NAME, VERSION);
  request.onupgradeneeded = upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

// Private helper for open that upgrades the database to the current
// version
function upgrade(event) {
  console.log('Upgrading database from version %s to %s',
    event.oldVersion, VERSION);
  const request = event.target;
  const connection = request.result;
  let feedStore = null, entryStore = null;
  const stores = connection.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = request.transaction.objectStore('feed');
  } else {
    feedStore = connection.createObjectStore('feed', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  if(stores.contains('entry')) {
    entryStore = request.transaction.objectStore('entry');
  } else {
    entryStore = connection.createObjectStore('entry', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  const feedIndices = feedStore.indexNames;
  const entryIndices = entryStore.indexNames;

  if(!feedIndices.contains('schemeless')) {
    feedStore.createIndex('schemeless', 'schemeless', {unique: true});
  }

  if(!feedIndices.contains('title')) {
    feedStore.createIndex('title', 'title');
  }

  if(feedIndices.contains('url')) {
    feedStore.deleteIndex('url');
  }

  // Deprecated
  if(entryIndices.contains('unread')) {
    entryStore.deleteIndex('unread');
  }

  // For example, used to count the number of unread entries
  if(!entryIndices.contains('readState')) {
    entryStore.createIndex('readState', 'readState');
  }

  if(!entryIndices.contains('feed')) {
    entryStore.createIndex('feed', 'feed');
  }

  if(!entryIndices.contains('archiveState-readState')) {
    entryStore.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
  }

  if(!entryIndices.contains('link')) {
    entryStore.createIndex('link', 'link', {unique: true});
  } else {
    const entryLinkIndex = entryStore.index('link');
    if(!entryLinkIndex.unique) {
      entryStore.deleteIndex('link');
      entryStore.createIndex('link', 'link', {unique: true});
    }
  }

  if(entryIndices.contains('hash')) {
    entryStore.deleteIndex('hash');
  }
}

} // END ANONYMOUS NAMESPACE
