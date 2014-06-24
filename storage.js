/**
 * Storage related functions (temp or persistent)
 */



function isRewritingEnabled() {
  return localStorage.URL_REWRITING_ENABLED;
}


/************* STORAGE RELATED FUNCTIONS *******************************
 * TODO: needs refactoring
 */

// Connect to indexedDB
function openDB(callback) {
  var request = indexedDB.open('reader', 9);
  request.onerror = console.error;
  request.onblocked = console.error;
  request.onupgradeneeded = onDBUpgradeNeeded;
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
}







/**
 * Changes from version 0 to 7 were not recorded, no longer important
 * Changes from old version 6 to version 7 added the title index to
 * feed store for sorting by title
 * Changes from old version 7 to version 8 drop the store.url index
 * and added the store.schemeless index. The url index was used to
 * check if a feed already existed when subscribing. The new schemeless
 * index serves the same purpose but is based on a property where the URLs
 * scheme is not stored.
 * Changes from 8 to 9: adding link index to entry store. the link index
 * is used to check if the article has already been downloaded.
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

function onDBUpgradeNeeded(event) {
  var db = event.target.result;

  console.log('Upgrading database from %s to %s',
    event.oldVersion, model.DATABASE_VERSION);

  if(event.oldVersion == 0) {
    // TODO: this branch needs testing again
    // - is the initial version 0 or 1????

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

    // For checking if URL fetched
    entryStore.createIndex('link','link');

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

    var entryStore = tx.objectStore('entry');

    entryStore.createIndex('link','link');

  } else if(event.oldVersion == 7) {

    var tx = event.currentTarget.transaction;
    var feedStore = tx.objectStore('feed');

    // Delete the url index (deprecated, using schemeless instead)
    feedStore.deleteIndex('url');

    // Add the schemeless index
    feedStore.createIndex('schemeless','schemeless',{unique:true});

    var entryStore = tx.objectStore('entry');
    entryStore.createIndex('link','link');

  } else if(event.oldVersion == 8) {

    var tx = event.currentTarget.transaction;
    var entryStore = tx.objectStore('entry');

    entryStore.createIndex('link','link');

  } else {
    console.error('Unhandled database upgrade, old version was %s', event.oldVersion);
  }
}