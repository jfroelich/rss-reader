// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// indexedDB functionality

// TODO: just store scheme and schemeless props as parts of a url object
// property? remember that indexeddb can access deeper props using '.' in
// keypaths.
// TODO: store urls as URL objects
// https://developer.mozilla.org/en-US/docs/Web/API/URL/URL

// Open a database connection. The callback receives the request event.
function db_open(callback) {
  'use strict';

  const DB_NAME = 'reader';
  const DB_VERSION = 17;

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = db_upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
}

function db_upgrade(event) {
  'use strict';
  console.log('Upgrading database from version %s', event.oldVersion);

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

// Removes all entry objects from the entry object store
function db_clear_entry_store(connection) {
  'use strict';

  if(connection) {
    clear_entries(connection);
  } else {
    db_open(on_open);
  }

  function on_open(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    clear_entries(connection);
  }

  function clear_entries(connection) {
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = on_complete;
    const store = transaction.objectStore('entry');
    store.clear();
  }

  function on_complete(event) {
    console.log('Cleared entry object store');
  }
}
