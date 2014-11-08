// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Opens a connection to indexedDB, attaches the common error handlers and the
 * upgrade callback, and sets the callback as the callback for the request
 * success event.
 *
 * TODO: deprecate the onsuccess function. Just use the callback itself. Expect
 * callers to use this.request or have a var db = event.target.request; statement
 * at the top of the callback.
 * TODO: eventually, this just needs to share the name, version, and upgradeNeeded
 * callback, and the openDatabase function itself should be deprecated. I no longer
 * think there is much of a benefit to introducing the additional layer of
 * indirection. Not every call to indexedDB.open needs an associated onupgradeneeded
 * callback. And every call needs to think more about issues with error handling.
 * Error handling may be different everywhere. And furthermore I need to better
 * understand the error bubbling mechanic that is part of idb.
 */
lucu.openDatabase = function(callback) {
  'use strict';
  var DATABASE_NAME = 'reader';
  var DATABASE_VERSION = 10;

  var request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

  //request.onsuccess = function() {
  //  callback(this.result);
  //};
  request.onsuccess = callback;

  request.onerror = console.error;
  request.onblocked = console.error;

  // TODO: ideally we would never store both schemeless and url, we would just
  // store scheme and schemeless props as parts of a url property.
  // TODO: every single branch below needs to bring the old version all the way
  // to the current version. This is because the user could be affected by an
  // upgrade that bumps them several versions at once. Make less DRY.

  request.onupgradeneeded = function(event) {
    var db = this.result;
    var oldVersion = event.oldVersion || 0;
    var feeds;
    var entries;

    // TODO: just use this.transaction?
    var transaction = event.currentTarget.transaction;

    console.info('Upgrading database from %s', oldVersion);

    if(oldVersion) {
      feeds = transaction.objectStore('feed');
      entries = transaction.objectStore('entry');
    }

    if(oldVersion == 0) {
      feeds = db.createObjectStore('feed', {keyPath:'id', autoIncrement: true});
      feeds.createIndex('schemeless','schemeless', {unique: true});
      feeds.createIndex('title','title');
      entries = db.createObjectStore('entry', {keyPath:'id', autoIncrement: true});
      entries.createIndex('unread','unread');
      entries.createIndex('feed','feed');
      entries.createIndex('link','link');
      entries.createIndex('hash','hash', {unique: true});
    } else if(oldVersion == 6) {
      feeds.createIndex('title','title');
      feeds.deleteIndex('url');
      feeds.createIndex('schemeless','schemeless', {unique: true});
      entries.createIndex('link','link');
      entries.deleteIndex('hash');
      entries.createIndex('hash','hash', {unique: true});
    } else if(oldVersion == 7) {
      feeds.deleteIndex('url');
      feeds.createIndex('schemeless','schemeless', {unique: true});
      entries.createIndex('link','link');
      entries.deleteIndex('hash');
      entries.createIndex('hash','hash', {unique: true});
    } else if(oldVersion == 8) {
      entries.createIndex('link','link');
      entries.deleteIndex('hash');
      entries.createIndex('hash','hash', {unique: true});
    } else if(oldVersion == 9) {
      entries.deleteIndex('hash');
      entries.createIndex('hash','hash', {unique: true});
    } else {
      console.error('Upgrade from %s unhandled', oldVersion);
    }
  };
};
