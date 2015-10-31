// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: just store scheme and schemeless props as parts of a url property.
// TODO: use 'lucubrate' as the database name
// TODO: rather than pass both event and connection to the callback,
// just pass back event and have the caller check if event.type != 'success'
function openDatabaseConnection(callback) {
  'use strict';
  const request = indexedDB.open('reader', 17);
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
    if(feedIndices.contains('url')) {
      feedStore.deleteIndex('url');
    }

    // TODO: rename to readState or something like that
    // TODO: we want to use read/unread, so non-membership is 
    // now an issue. So we actually want to always store a value
    // That changes how loading unread entries works as well
    
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
  };

  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
  return request;
}
