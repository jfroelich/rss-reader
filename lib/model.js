
// TODO: consider breaking this up into separate things
// instead of just cramming all of this into the same thing.

// Storage-related functions

var model = {};

model.DATABASE_NAME = 'reader';
model.DATABASE_VERSION = 8;

// If an entry's unread property has this value then it is unread. 
// We are using an integer flag because indexedDB does not support 
// indices on booleans.
model.UNREAD = 1;

// Connect to indexedDB
model.connect = function(callback) {
  var request = indexedDB.open(model.DATABASE_NAME, model.DATABASE_VERSION);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = this.onupgradeneeded_;
  request.onsuccess = function(event) {
    
    if(callback) {
      callback(event.target.result);  
    } else {
      console.warn('called model.connect without callback');
    }

  };
};


/**
 * Changes from version 0 to 7 were not recorded, no longer important
 * Changes from old version 6 to version 7 added the title index to 
 * feed store for sorting by title
 * Changes from old version 7 to version 8 drop the store.url index 
 * and added the store.schemeless index. The url index was used to 
 * check if a feed already existed when subscribing. The new schemeless 
 * index serves the same purpose but is based on a property where the URLs 
 * scheme is not stored.
 *
 * Note: ideally we would never store both schemeless and url, we would just 
 * store scheme and schemeless props as parts of the url property. Consider 
 * making this change at some point prior to release when I dont mind deleting 
 * the test data.
 *
 * Every single branch below needs to bring that old version all the way to the 
 * current version. This is because the user could be affected by an upgrade 
 * that bumps them several versions at once.
 */

model.onupgradeneeded_ = function(event) {
  var db = event.target.result;

  console.log('Upgrading database from %s to %s',
    event.oldVersion, model.DATABASE_VERSION);

  if(event.oldVersion == 0) {
    // TODO: this branch needs testing again
    // - is the initial version 0 or 1????
    // NOTE: this seriously needs testing, it is the very first
    // serious branch of code called on install and first run

    //console.log('Setting up database for first time');
    
    //console.log('Creating feed store');
    var feedStore = db.createObjectStore('feed', {keyPath:'id',autoIncrement:true});
    
    // For checking if already subscribed
    // No longer in use, use schemeless instead
    //feedStore.createIndex('url','url',{unique:true});
    
    feedStore.createIndex('schemeless','schemeless',{unique:true});

    // For loading feeds in alphabetical order
    feedStore.createIndex('title','title');

    //console.log('Create entry store');
    var entryStore = db.createObjectStore('entry', {keyPath:'id',autoIncrement:true});

    // For quickly counting unread 
    // and for iterating over unread in id order
    entryStore.createIndex('unread','unread');

    // For quickly deleting entries when unsubscribing
    entryStore.createIndex('feed','feed');

    // For quickly checking whether a similar entry exists
    entryStore.createIndex('hash','hash');

  } else if(event.oldVersion == 6) {
    //console.log('Upgrading database from %s', event.oldVersion);
    var tx = event.currentTarget.transaction;
    
    var feedStore = tx.objectStore('feed');
    
    // Add the title index
    feedStore.createIndex('title','title');
    
    // Delete the url index (deprecated, using schemeless instead)
    feedStore.deleteIndex('url');
    
    // Add the schemeless index
    feedStore.createIndex('schemeless','schemeless',{unique:true});
    
  } else if(event.oldVersion == 7) {

    var tx = event.currentTarget.transaction;
    var feedStore = tx.objectStore('feed');

    // Delete the url index (deprecated, using schemeless instead)
    feedStore.deleteIndex('url');
    
    // Add the schemeless index
    feedStore.createIndex('schemeless','schemeless',{unique:true});

  } else {
    console.error('Unhandled database upgrade, old version was %s', event.oldVersion);
  }
};

model.forEachFeed = function(db, callback, oncomplete, sortByTitle) {
  var tx = db.transaction('feed');
  tx.oncomplete = oncomplete;

  var store = sortByTitle ? tx.objectStore('feed').index('title') : tx.objectStore('feed');
  store.openCursor().onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      callback(cursor.value);
      cursor.continue();
    }
  };
};