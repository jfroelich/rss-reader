// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var DATABASE_NAME = 'reader';
var DATABASE_VERSION = 10;

/**
 * Opens a connection to indexedDB, attaches the common
 * error handlers and the upgrade callback, and then passes
 * the connection to the callback
 */
function openIndexedDB(callback) {
  var request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = upgradeDatabase;
  //request.onsuccess = function onOpenIndexedDBSuccess() {
  //  callback(this.result);
  //};
  request.onsuccess = onOpenIndexedDBSuccess.bind(request, callback);
}

function onOpenIndexedDBSuccess(callback) {
  callback(this.result);
}

/**
 * This gets automatically called every time the version is incremented and
 * is responsible for changing the schema of the database.
 *
 * Changes:
 * Version 7: added feedStore title index
 * Version 8: removed feedStore url index, added feedStore schemeless index
 * Version 9: added entryStore link index
 * Version 10: entryStore hash index is now unique
 *
 * TODO: ideally we would never store both schemeless and url, we would just
 * store scheme and schemeless props as parts of the url property.
 *
 * TODO: every single branch below needs to bring the old version all the way
 * to the current version. This is because the user could be affected by an
 * upgrade that bumps them several versions at once. Make less DRY.
 */
function upgradeDatabase(event) {
  var db = this.result;
  var oldVersion = event.oldVersion;

  var feedStore;
  var entryStore;

  // TODO: is this.transaction be sufficient?
  var transaction = event.currentTarget.transaction;

  console.log('Upgrading database from %s to %s', oldVersion, DATABASE_VERSION);

  if(oldVersion) {
    feedStore = transaction.objectStore('feed');
    entryStore = transaction.objectStore('entry');
  }

  if(oldVersion == 0) {
    feedStore = db.createObjectStore('feed', {keyPath:'id', autoIncrement:true});
    feedStore.createIndex('schemeless','schemeless',{unique:true});
    feedStore.createIndex('title','title');
    entryStore = db.createObjectStore('entry', {keyPath:'id', autoIncrement:true});
    entryStore.createIndex('unread','unread');
    entryStore.createIndex('feed','feed');
    entryStore.createIndex('link','link');
    entryStore.createIndex('hash','hash', {unique:true});
  } else if(oldVersion == 6) {
    feedStore.createIndex('title','title');
    feedStore.deleteIndex('url');
    feedStore.createIndex('schemeless','schemeless', {unique:true});
    entryStore.createIndex('link','link');
    entryStore.deleteIndex('hash');
    entryStore.createIndex('hash','hash', {unique:true});
  } else if(oldVersion == 7) {
    feedStore.deleteIndex('url');
    feedStore.createIndex('schemeless','schemeless', {unique:true});
    entryStore.createIndex('link','link');
    entryStore.deleteIndex('hash');
    entryStore.createIndex('hash','hash', {unique:true});
  } else if(oldVersion == 8) {
    entryStore.createIndex('link','link');
    entryStore.deleteIndex('hash');
    entryStore.createIndex('hash','hash', {unique:true});
  } else if(oldVersion == 9) {
    entryStore.deleteIndex('hash');
    entryStore.createIndex('hash','hash', {unique:true});
  } else {
    console.error('failed to upgrade database from version %s', oldVersion);
  }
}
