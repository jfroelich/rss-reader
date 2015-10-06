// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.database = {};

// TODO: ideally we would never store both schemeless and url, we would just
// store scheme and schemeless props as parts of a url property.
// TODO: use 'lucubrate' as the database name

lucu.database.NAME = 'reader';
lucu.database.VERSION = 15;

/**
 * Calls callback with two arguments, error and database. Error is 
 * always null. database is an instance of IDBDatabase.
 */
lucu.database.connect = function(callback, fallback) {
  'use strict';
  var openRequest = indexedDB.open(lucu.database.NAME, lucu.database.VERSION);
  openRequest.onupgradeneeded = lucu.database.upgrade;
  openRequest.onsuccess = lucu.database.onConnect.bind(null, callback);
  openRequest.onerror = fallback;
  openRequest.onblocked = fallback;
  return openRequest;
};

lucu.database.onConnect = function(callback, event) {
  'use strict';
  // Pass back null for simple async.waterfall integration
  callback(null, event.target.result);
};

lucu.database.upgrade = function(event) {
  'use strict';

  console.debug('Upgrading database from version %s', event.oldVersion);

  var request = event.target;
  var database = request.result;
  var feedStore = null;
  var entryStore = null;
  var stores = database.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = request.transaction.objectStore('feed');
  } else {
    feedStore = database.createObjectStore('feed', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  if(stores.contains('entry')) {
    entryStore = request.transaction.objectStore('entry');
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
    var entryLinkIndex = entryStore.index('link');
    if(!entryLinkIndex.unique) {
      entryStore.deleteIndex('link');
      entryStore.createIndex('link', 'link', {unique: true});
    }
  }

  // Hash was deprecated
  if(entryIndices.contains('hash')) {
    entryStore.deleteIndex('hash');
  }
};

lucu.database.clearEntries = function() {
  'use strict';
  lucu.database.connect(lucu.database.onClearEntriesConnect, console.error);
};

lucu.database.onClearEntriesConnect = function(error, database) {
  'use strict';
  var transaction = database.transaction('entry', 'readwrite');
  var entryStore = transaction.objectStore('entry');
  var clearRequest = entryStore.clear();
  clearRequest.onerror = console.debug;
  clearRequest.onsuccess = function(event) {
    console.debug('Cleared entry object store');
  };
};
