// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.db = {};

// TODO: use 'lucubrate' as the database name

lucu.db.NAME = 'reader';
lucu.db.VERSION = 11;

lucu.db.upgrade = function(event) {
  'use strict';
  // TODO: ideally we would never store both schemeless and url, we would just
  // store scheme and schemeless props as parts of a url property.
  // NOTE: every single branch below needs to bring the old version all the way
  // to the current version. This is because the user could be affected by an
  // upgrade that bumps them several versions at once.
  // TODO: Make less DRY.

  var db = this.result;
  var oldVersion = event.oldVersion || 0;

  console.info('Upgrading database from version %s', oldVersion);

  var feeds = this.transaction.objectStore('feed');
  var entries = this.transaction.objectStore('entry');

  if(oldVersion === 0) {
    feeds = db.createObjectStore('feed', {keyPath:'id', autoIncrement: true});
    feeds.createIndex('schemeless','schemeless', {unique: true});
    feeds.createIndex('title','title');
    entries = db.createObjectStore('entry', {keyPath:'id', autoIncrement: true});
    entries.createIndex('unread','unread');
    entries.createIndex('feed','feed');
    entries.createIndex('link','link', {unique: true});
    // entries.createIndex('hash','hash', {unique: true});
  } else if(oldVersion === 6) {
    feeds.createIndex('title','title');
    feeds.deleteIndex('url');
    feeds.createIndex('schemeless','schemeless', {unique: true});
    entries.deleteIndex('link');
    entries.createIndex('link','link', {unique: true});
    entries.deleteIndex('hash');
    //entries.createIndex('hash','hash', {unique: true});
  } else if(oldVersion === 7) {
    feeds.deleteIndex('url');
    feeds.createIndex('schemeless','schemeless', {unique: true});
    entries.deleteIndex('link');
    entries.createIndex('link','link', {unique: true});
    entries.deleteIndex('hash');
    //entries.createIndex('hash','hash', {unique: true});
  } else if(oldVersion === 8) {
    feeds.deleteIndex('url');
    entries.deleteIndex('link');
    entries.createIndex('link','link', {unique: true});
    entries.deleteIndex('hash');
    //entries.createIndex('hash','hash', {unique: true});
  } else if(oldVersion === 9) {
    feeds.deleteIndex('url');
    entries.deleteIndex('hash');
    // entries.createIndex('hash','hash', {unique: true});
    entries.deleteIndex('link');
    entries.createIndex('link','link', {unique: true});
  } else if(oldVersion === 10) {
    feeds.deleteIndex('url');

    // Deprecating hash, entry link is now primary key
    entries.deleteIndex('hash');

    // Because link is now primary, impose a new unique
    // requirement
    entries.deleteIndex('link');
    entries.createIndex('link','link', {unique: true});

    // TODO: once we transition to link and it is working again,
    // consider deprecating id and using link as the table's key

  } else {
    console.error('Database upgrade error, no upgrade transform '+
      'handler for version %s', oldVersion);
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
