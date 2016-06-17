// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: i think what i want is multiple urls mapping to a single remote
// resource. so i want feeds and entries each to have a urls array, and
// i want to create multi-entry indices on these properties, and then i want
// to use those indices to determine equality. In the array I should store
// the original url, the rewritten url, and the post-redirect url. Also, I
// should be normalizing the urls some how, so that protocol is not
// case-sensitive, so that https feed is recognized as the same as the http
// version of the feed, so that domain is case insensitive

const db = {};

db.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};


db.open = function(callback) {
  const DB_NAME = 'reader';
  const DB_VERSION = 18;

  const request = indexedDB.open(DB_NAME, DB_VERSION);
  request.onupgradeneeded = db.upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

db.upgrade = function(event) {
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

  // Deprecated
  if(feedIndices.contains('schemeless')) {
    feedStore.deleteIndex('schemeless');
  }

  // Deprecated. Use the new urls index
  if(feedIndices.contains('url')) {
    feedStore.deleteIndex('url');
  }

  // Create a multi-entry index using the new urls property, which should
  // be an array of unique strings of normalized urls
  if(!feedIndices.contains('urls')) {
    feedStore.createIndex('urls', 'urls', {
      'multi-entry': true,
      'unique': true
    });
  }

  // TODO: deprecate this, have the caller manually sort and stop requiring
  // title, this just makes it difficult.
  if(!feedIndices.contains('title')) {
    feedStore.createIndex('title', 'title');
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

  // Deprecated. Use the urls index instead.
  if(entryIndices.contains('link')) {
    entryStore.deleteIndex('link');
  }

  // Deprecated. Use the urls index instead.
  if(entryIndices.contains('hash')) {
    entryStore.deleteIndex('hash');
  }

  if(!entryIndices.contains('urls')) {
    entryStore.createIndex('urls', 'urls', {
      'multi-entry': true,
      'unique': true
    });
  }
};

db.clearEntryStore = function(connection) {
  if(connection) {
    clearEntries(connection);
  } else {
    db.open(onOpen);
  }

  return 'Requesting entry store to be cleared.';

  function onOpen(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    clearEntries(connection);
  }

  function clearEntries(connection) {
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    store.clear();
  }

  function onComplete(event) {
    console.log('Cleared entry object store');
    utils.updateBadgeUnreadCount(event.target.db);
  }
};
