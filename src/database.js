// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.db = {};

// TODO: ideally we would never store both schemeless and url, we would just
// store scheme and schemeless props as parts of a url property.
// TODO: use 'lucubrate' as the database name

lucu.db.NAME = 'reader';
lucu.db.VERSION = 15;

lucu.db.upgrade = function(event) {
  'use strict';

  var oldVersion = event.oldVersion;
  console.debug('Upgrading database from version %s', oldVersion);

  var database = event.target.result;
  var feedStore = null;
  var entryStore = null;
  var stores = database.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = this.transaction.objectStore('feed');
  } else {
    feedStore = database.createObjectStore('feed', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  if(stores.contains('entry')) {
    entryStore = this.transaction.objectStore('entry');
  } else {
    entryStore = database.createObjectStore('entry', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  var feedIndices = feedStore.indexNames;
  var entryIndices = entryStore.indexNames;

  if(!feedIndices.contains('schemeless')) {
    feedStore.createIndex('schemeless', 'schemeless', {unique: true});
  }

  if(!feedIndices.contains('title')) {
    feedStore.createIndex('title', 'title');
  }

  // Feed url index was deprecated
  if(feedIndices.contains('url')) {
    console.debug('Database upgrade - deleting feed.url index');
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
    // The link index should be unique. This was changed around version 11.
    // TODO: what happens if duplicates exist in the database at the time this
    // runs? Did not appear to generate an error. I suppose it only applies to 
    // future add/put calls and does not retroactively enforce the constraint.
    var entryLinkIndex = entryStore.index('link');
    if(!entryLinkIndex.unique) {
      console.debug('Database upgrade - adding unique constraint to entry.link index');
      entryStore.deleteIndex('link');
      entryStore.createIndex('link', 'link', {unique: true});
    }
  }

  // Hash was deprecated, as we now refer to entries uniquely by link
  if(entryIndices.contains('hash')) {
    console.debug('Database upgrade - deleting entry.hash index');
    entryStore.deleteIndex('hash');
  }
};

lucu.db.clearEntries = function() {
  var openRequest = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  openRequest.onerror = console.debug;
  openRequest.onsuccess = function(event) {
    var database = event.target.result;
    var transaction = database.transaction('entry', 'readwrite');
    var entryStore = transaction.objectStore('entry');
    var clearRequest = entryStore.clear();
    clearRequest.onerror = console.debug;
    clearRequest.onsuccess = function() {
      console.debug('Cleared entry object store');
    };
  };
};
