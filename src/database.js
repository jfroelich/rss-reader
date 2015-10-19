// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: ideally we would never store both schemeless and url, we would just
// store scheme and schemeless props as parts of a url property.
// TODO: use 'lucubrate' as the database name
// Calls callback with two arguments, error and database. database is an 
// instance of IDBDatabase.
function openDatabaseConnection(callback) {
  'use strict';

  const request = indexedDB.open('reader', 15);
  
  request.onupgradeneeded = function(event) {
    console.debug('Upgrading database from version %s', event.oldVersion);

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

    // Feed url index was deprecated
    if(feedIndices.contains('url')) {
      feedStore.deleteIndex('url');
    }

    if(!entryIndices.contains('unread')) {
      entryStore.createIndex('unread', 'unread');
    }

    if(!entryIndices.contains('feed')) {
      entryStore.createIndex('feed', 'feed');
    }

    if(!entryIndices.contains('link')) {
      entryStore.createIndex('link', 'link', {unique: true});
    } else {
      // Ensure the link index has a unique flag
      const entryLinkIndex = entryStore.index('link');
      if(!entryLinkIndex.unique) {
        entryStore.deleteIndex('link');
        entryStore.createIndex('link', 'link', {unique: true});
      }
    }

    if(entryIndices.contains('hash')) {
      entryStore.deleteIndex('hash');
    }
  };

  request.onsuccess = function(event) {
    callback(null, event.target.result);
  };
  request.onerror = callback;
  request.onblocked = callback;
  return request;
};
