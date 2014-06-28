/**
 * Storage related functions (temp or persistent)
 */
'use strict';

var database = {};

database.NAME = 'reader';
database.VERSION = 10;

/**
 * Opens a connection to indexedDB, attaches the common
 * error handlers and the upgrade callback, and then passes
 * the open connection handle as an argument to the callback
 * function
 */
database.open = function(callback) {
  var request = indexedDB.open(database.NAME, database.VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = database.upgrade;
  request.onsuccess = function() {
    // this == event.target
    callback(this.result);
  };
};

/**
 * This gets automatically called every time the version is incremented and
 * is responsible for changing the schema of the database.
 *
 * Changes:
 * 6 to 7: added feedStore title index
 * 7 to 8: removed feedStore url index, added feedStore schemeless index
 * 8 to 9: added entryStore link index
 * 9 to 10: entryStore hash index is now unique
 *
 * TODO: ideally we would never store both schemeless and url, we would just
 * store scheme and schemeless props as parts of the url property.
 *
 * TODO: every single branch below needs to bring the old version all the way
 * to the current version. This is because the user could be affected by an
 * upgrade that bumps them several versions at once. Right now this is doing
 * a ton of redundant stuff and should be revised.
 */
database.upgrade = function(event) {
  var db = this.result;
  var oldVersion = event.oldVersion;
  var thisTransaction = event.currentTarget.transaction;
  var feedStore = oldVersion ? thisTransaction.objectStore('feed') : undefined;
  var entryStore = oldVersion ? thisTransaction.objectStore('entry') : undefined;

  console.log('Upgrading database from %s to %s', oldVersion, database.VERSION);

  if(oldVersion == 0) {
    feedStore = db.createObjectStore('feed', {keyPath:'id', autoIncrement:true});
    feedStore.createIndex('schemeless','schemeless',{unique:true});
    feedStore.createIndex('title','title');
    entryStore = db.createObjectStore('entry', {keyPath:'id', autoIncrement:true});
    entryStore.createIndex('unread','unread');
    entryStore.createIndex('feed','feed');
    entryStore.createIndex('hash','hash', {unique:true});
    entryStore.createIndex('link','link');
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
    console.error('Version change not handled in database.upgrade');
  }
};