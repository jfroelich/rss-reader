// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.database = {};

lucu.database.NAME = 'reader';

lucu.database.VERSION = 10;

/**
 * Opens a connection to indexedDB, attaches the common
 * error handlers and the upgrade callback, and then passes
 * the connection to the callback
 */
lucu.database.open = function(callback) {
  var request = indexedDB.open(lucu.database.NAME,
    lucu.database.VERSION);

  // TODO: are these automatically raised to the top or would not setting
  // these cause silence?
  request.onerror = console.error;
  request.onblocked = console.error;

  request.onupgradeneeded = lucu.database.onUpgradeNeeded_;
  request.onsuccess = lucu.database.onOpen_.bind(request, callback);
};

// Private helper that pulls out the connection object to pass it to
// the callback so that the callback is not aware of the wrapping request
lucu.database.onOpen_ = function(callback) {
  // NOTE: this instanceof IDBRequest
  callback(this.result);
};

/**
 * Called when the version is incremented. Changes the schema
 *
 * Changes:
 * Version 7: added feedStore title index
 * Version 8: removed feedStore url index, added feedStore schemeless index
 * Version 9: added entryStore link index
 * Version 10: entryStore hash index is now unique
 *
 * TODO: ideally we would never store both schemeless and url, we would just
 * store scheme and schemeless props as parts of a url property.
 *
 * TODO: every single branch below needs to bring the old version all the way
 * to the current version. This is because the user could be affected by an
 * upgrade that bumps them several versions at once. Make less DRY.
 */
lucu.database.onUpgradeNeeded_ = function(event) {

  // NOTE: this instanceof IDBRequest, right?

  var db = this.result;
  var oldVersion = event.oldVersion || 0;
  var newVersion = lucu.database.VERSION;

  var feedStore;
  var entryStore;

  // TODO: just use this.transaction?
  var transaction = event.currentTarget.transaction;

  console.info('Upgrading database from %s to %s', oldVersion, newVersion);

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
    console.error('Failed to upgrade database from version %s', oldVersion);
  }
};
