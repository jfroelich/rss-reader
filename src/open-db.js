// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

const name = 'reader';
const version = 20;

this.open_db = function(callback) {
  const request = indexedDB.open(name, version);
  request.onupgradeneeded = upgrade;
  request.onsuccess = on_success.bind(request, callback);
  request.onerror = on_error.bind(request, callback);
  request.onblocked = on_blocked.bind(request, callback);
};

function on_success(callback, event) {
  callback(event.target.result);
}

function on_error(callback, event) {
  console.error(event);
  callback();
}

function on_blocked(callback, event) {
  console.warn(event);
  callback();
}

function upgrade(event) {
  console.log('Upgrading database %s from version', name, event.oldVersion);

  const request = event.target;
  const connection = request.result;
  let feed_store = null, entry_store = null;
  const stores = connection.objectStoreNames;

  if(stores.contains('feed')) {
    feed_store = request.transaction.objectStore('feed');
  } else {
    feed_store = connection.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  if(stores.contains('entry')) {
    entry_store = request.transaction.objectStore('entry');
  } else {
    entry_store = connection.createObjectStore('entry', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const feed_indices = feed_store.indexNames;
  const entry_indices = entry_store.indexNames;

  // Deprecated
  if(feed_indices.contains('schemeless')) {
    feed_store.deleteIndex('schemeless');
  }

  // Deprecated. Use the new urls index
  if(feed_indices.contains('url')) {
    feed_store.deleteIndex('url');
  }

  // Create a multi-entry index using the new urls property, which should
  // be an array of unique strings of normalized urls
  if(!feed_indices.contains('urls')) {
    feed_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  }

  // TODO: deprecate this, have the caller manually sort and stop requiring
  // title, this just makes it difficult.
  if(!feed_indices.contains('title')) {
    feed_store.createIndex('title', 'title');
  }

  // Deprecated
  if(entry_indices.contains('unread')) {
    entry_store.deleteIndex('unread');
  }

  // For example, used to count the number of unread entries
  if(!entry_indices.contains('readState')) {
    entry_store.createIndex('readState', 'readState');
  }

  if(!entry_indices.contains('feed')) {
    entry_store.createIndex('feed', 'feed');
  }

  if(!entry_indices.contains('archiveState-readState')) {
    entry_store.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
  }

  // Deprecated. Use the urls index instead.
  if(entry_indices.contains('link')) {
    entry_store.deleteIndex('link');
  }

  // Deprecated. Use the urls index instead.
  if(entry_indices.contains('hash')) {
    entry_store.deleteIndex('hash');
  }

  if(!entry_indices.contains('urls')) {
    entry_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  }
}

} // End file block scope
