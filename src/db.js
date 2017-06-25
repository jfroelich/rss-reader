// See license.md

'use strict';

const db = {};

db.defaultName = 'reader';
db.defaultVersion = 20;

db.connect = function(name = db.defaultName, version = db.defaultVersion) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = db.onUpgradeNeeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      console.warn('Waiting on blocked connection...');
  });
};

db.onUpgradeNeeded = function(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feedStore, entryStore;
  const stores = conn.objectStoreNames;

  console.log('Upgrading database %s to version %s from version', conn.name,
    event.version, event.oldVersion);

  if(event.oldVersion < 20) {
    feedStore = conn.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
    entryStore = conn.createObjectStore('entry', {
      'keyPath': 'id',
      'autoIncrement': true
    });
    feedStore.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
    feedStore.createIndex('title', 'title');
    entryStore.createIndex('readState', 'readState');
    entryStore.createIndex('feed', 'feed');
    entryStore.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
    entryStore.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  } else {
    feedStore = tx.objectStore('feed');
    entryStore = tx.objectStore('entry');
  }
};

db.deleteDatabase = function(name) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

db.removeFeed = function(tx, feedId) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('feed');
    const request = store.delete(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Load an array of all feed ids
db.getFeedIdArray = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

db.getFeedArray = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// TODO: this should not be doing anything other than adding the object it
// was given
// TODO: deprecate, require caller to use put everywhere
// TODO: move obj prep to caller, use put logic, rename to putFeed
db.addFeed = function(conn, feedObject) {
  return new Promise((resolve, reject) => {
    if('id' in feedObject)
      return reject(new TypeError());
    let storable = feed.sanitize(feedObject);
    storable = utils.filterEmptyProperties(storable);
    storable.dateCreated = new Date();
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.add(storable);
    request.onsuccess = () => {
      storable.id = request.result;
      resolve(storable);
    };
    request.onerror = () => reject(request.error);
  });
};

// TODO: this should do absolutely nothing to to the object it is given, the
// caller is responsible
// TODO: probably resolving with just new id is sufficient here now that this
// no longer is responsible for sanitization, because it means the caller has
// the sanitized values already
// Adds or overwrites a feed in storage. Resolves with the stored feed. If
// adding then the generated id is set on the input feed object.
// @param feed {Object}
db.putFeed = function(conn, feedObject) {
  return new Promise((resolve, reject) => {
    feedObject.dateUpdated = new Date();
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feedObject);
    request.onsuccess = () => {
      feedObject.id = feedObject.id || request.result;
      resolve(feedObject);
    };
    request.onerror = () => reject(request.error);
  });
};

// Returns true if a feed exists in the database with the given url
// @param url {String}
db.containsFeedURL = function(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
};

// @param id {Number} feed id, positive integer
db.findFeedById = function(conn, id) {
  return new Promise((resolve, reject) => {
    if(!Number.isInteger(id) || id < 1)
      return reject(new TypeError('Invalid feed id ' + id));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

db.getEntryIdsByFeedId = function(tx, feedId) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

db.getEntryArray = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

db.getUnarchivedReadEntryArray = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [entry.UNARCHIVED_STATE, entry.READ_STATE];
    const request = index.getAll(key_path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance.
// TODO: internally the parameter to getAll might be (offset+limit)
db.getUnarchivedUnreadEntryArray = function(conn, offset, limit) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = () => resolve(entries);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [entry.UNARCHIVED_STATE, entry.UNREAD_STATE];
    const request = index.openCursor(keyPath);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }
      if(offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
        return;
      }
      entries.push(cursor.value);
      if(limited && ++counter < limit) {
        cursor.continue();
      }
    };
    request.onerror = () => reject(request.error);
  });
};

db.findEntryByEntryId = function(conn, id) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const request = tx.objectStore('entry').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

db.countUnreadEntries = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(entry.UNREAD_STATE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// TODO: tx can't be exposed as it is leaky abstraction?
// TODO: allow for undefined chan
// @param tx {IDBTransaction}
// @param id {int}
// @param chan {BroadcastChannel}
db.removeEntryByEntryId = function(tx, id, chan) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      resolve();
      chan.postMessage({'type': 'entryDeleted', 'id': id});
    };
    request.onerror = () => reject(request.error);
  });
};

db.removeEntriesWithIds = async function(conn, ids, chan) {
  const tx = conn.transaction('entry', 'readwrite');
  const proms = ids.map((id) => db.removeEntryByEntryId(tx, id, chan));
  return await Promise.all(proms);
};

// TODO: deprecate in favor of put, and after moving sanitization and
// default props out, maybe make a helper function in pollfeeds that does this
// TODO: ensure entries added by put, if not have id, have unread flag
// and date created
// TODO: this should be nothing other than putting. Caller is responsible
// for sanitizing and setting defaults.
db.addEntry = function(conn, entryObject) {
  return new Promise((resolve, reject) => {
    if('id' in entryObject) {
      return reject(new TypeError());
    }

    const sanitized = entry.sanitize(entryObject);
    const storable = utils.filterEmptyProperties(sanitized);
    storable.readState = entry.UNREAD_STATE;
    storable.archiveState = entry.UNARCHIVED_STATE;
    storable.dateCreated = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.add(storable);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

db.putEntry = async function(conn, entryObject) {
  const tx = conn.transaction('entry', 'readwrite');
  return await db.putEntryWithTx(tx, entryObject);
};


// TODO: it should be callers responsibility to set dateUpdated, this should
// just put the entry as is
// TODO: probably should not bother with sharing tx, should just use separate
// txs, and then deal with optimizing put all if it is an perf issue. Integrity
// wise I am not sure it matters
// Resolves when the entry has been stored to the result of the request
// If entry.id is not set this will result in adding
// Sets dateUpdated before put. Impure.
// @param tx {IDBTransaction}
db.putEntryWithTx = function(tx, entryObject) {
  return new Promise((resolve, reject) => {
    entryObject.dateUpdated = new Date();
    const request = tx.objectStore('entry').put(entryObject);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Promise.all is failfast so this aborts if any one entry fails
db.putEntries = async function(conn, entryArray) {
  const tx = conn.transaction('entry', 'readwrite');
  const promiseArray = new Array(entryArray.length);
  for(let entryObject of entryArray) {
    const promise = db.putEntryWithTx(tx, entryObject);
    promiseArray.push(promise);
  }

  const resolutionsArray = await Promise.all(promiseArray);
  return resolutionsArray;
};

// Resolves with a boolean indicating whether an entry with the given url
// was found in storage
// @param url {String}
db.containsEntryWithURL = function(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
};
