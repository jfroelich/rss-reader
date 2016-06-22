// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const db = Object.create(null);

db.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

db.open = function(callback) {
  const request = indexedDB.open('reader', 20);
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
      'multiEntry': true,
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
      'multiEntry': true,
      'unique': true
    });
  }
};

db.openReadUnarchivedEntryCursor = function(connection, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [db.EntryFlags.UNARCHIVED, db.EntryFlags.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.openUnreadUnarchivedEntryCursor = function(connection, callback) {
  const transaction = connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const index = entryStore.index('archiveState-readState');
  const keyPath = [db.EntryFlags.UNARCHIVED, db.EntryFlags.UNREAD];
  const request = index.openCursor(keyPath);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.openEntryCursorForFeed = function(connection, feedId, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(feedId);
  request.onsuccess = callback;
};

// NOTE: even though the count can include archived, I don't think it matters
// because I am currently assuming an entry can never be unread and archived.
db.countUnreadEntries = function(connection, callback) {
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(db.EntryFlags.UNREAD);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.openFeedsCursor = function(connection, callback) {
  const transaction = connection.transaction('feed');
  const feedStore = transaction.objectStore('feed');
  const request = feedStore.openCursor();
  request.onsuccess = callback;
  request.onerror = callback;
};

// TODO: this requires feeds have a title in order to appear in the index.
// I would prefer instead to remove this requirement, load all feeds, and
// sort manually, allowing for untitled feeds. I think? Tentative.
db.openFeedsCursorSortedByTitle = function(connection, callback) {
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('title');
  const request = index.openCursor();
  request.onsuccess = callback;
};

db.findFeedById = function(connection, feedId, callback) {
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.get(feedId);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.deleteFeedById = function(connection, feedId, callback) {
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(feedId);
  request.onsuccess = callback;
};

db.getEntryById = function(connection, entryId, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(entryId);
  request.onsuccess = callback;
  request.onerror = callback;
};

// Expects a URL object, not a string. This will convert the url to a string
// and search with the string. Converting the url to a string will normalize
// the url, in the same way the url was normalized when storing the entry, so
// that only normalized urls are compared against each other. So, for example,
// 'http://www.domain.com/page.html' will match
// 'HTTP://WWW.DOMAIN.COM/page.html'. The second reason is that indexedDB
// cannot directly store URL objects (for an unknown reason).
db.findEntryWithURL = function(connection, url, callback) {
  const transaction = connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const urlsIndex = entryStore.index('urls');
  const request = urlsIndex.get(url.href);
  request.onsuccess = callback;
  request.onerror = callback;
};

// Use an isolated transaction for storing an entry. The problem with using a
// shared transaction in the case of a batch insert is that the uniqueness
// check from index constraints is db-delegated and unknown apriori without a
// separate lookup request, and that any constraint failure causes the entire
// transaction to fail.
db.addEntry = function(connection, entry, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const entryStore = transaction.objectStore('entry');
  const request = entryStore.add(entry);
  request.onsuccess = callback;
  request.onerror = callback;
};

// TODO: do not modify the input feed. Instead, create a storable copy
// and copy over the fields from the input.
// TODO: note that this uses the new field name, and the Date type
db.addFeed = function(connection, feed, callback) {

  // Define the date created property here
  feed.dateCreated = new Date();

  // Temporary legacy code, will eventually delete
  feed.created = Date.now();

  const transaction = connection.transaction('feed', 'readwrite');
  const feedStore = transaction.objectStore('feed');
  const request = feedStore.add(feed);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.updateFeed = function(connection, feed, callback) {
  // TODO: it is this function's responsibility to set dateUpdated
  // TODO: maybe do not modify date updated if no values changed

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = callback;
  request.onerror = callback;
};

// TODO: maybe deprecate and just use the clear button provided by
// the inspector
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
    updateBadgeUnreadCount(event.target.db);
  }
};
