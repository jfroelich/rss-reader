// See license.md

'use strict';

// NOTE: after some thought, I don't see much point to abstracting farther
// away from indexedDB in the case I may want to swap the storage mechanism,
// so I think it is ok to have tx and conn as params to various other fns

const dbDefaultName = 'reader';
const dbDefaultVersion = 20;

function dbConnect(name = dbDefaultName, version = dbDefaultVersion) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = dbOnUpgradeNeeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      console.warn('Waiting on blocked connection...');
  });
}

function dbOnUpgradeNeeded(event) {
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
}

function dbDeleteDatabase(name) {
  return new Promise((resolve, reject) {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbRemoveFeed(tx, id) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('feed');
    const request = store.delete(id);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Load an array of all feed ids
function dbGetFeedIds(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGetFeeds(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: this should not be doing anything other than adding the object it
// was given
// TODO: deprecate, require caller to use put everywhere
// TODO: move obj prep to caller, use put logic, rename to putFeed
function dbAddFeed(conn, feed) {
  return new Promise((resolve, reject) => {
    if('id' in feed)
      return reject(new TypeError());
    let storable = jrFeedSanitize(feed);
    storable = jrUtilsFilterEmptyProps(storable);
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
}

// TODO: this should do absolutely nothing to to the object it is given, the
// caller is responsible
// TODO: probably resolving with just new id is sufficient here now that this
// no longer is responsible for sanitization, because it means the caller has
// the sanitized values already
// Adds or overwrites a feed in storage. Resolves with the stored feed. If
// adding then the generated id is set on the input feed object.
// @param feed {Object}
function dbPutFeed(conn, feed) {
  return new Promise((resolve, reject) => {
    feed.dateUpdated = new Date();
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      feed.id = feed.id || request.result;
      resolve(feed);
    };
    request.onerror = () => reject(request.error);
  });
}

// Returns true if a feed exists in the database with the given url
// @param url {String}
function dbContainsFeedURL(conn, url) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}

// @param id {Number} feed id, positive integer
function dbFindFeedById(conn, id) {
  return new Promise((resolve, reject) => {
    if(!Number.isInteger(id) || id < 1)
      return reject(new TypeError('Invalid feed id ' + id));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


// TODO: tx can't be exposed, this is a leaky abstraction? Maybe there is not
// even that much of a benefit to reusing id, I could just create a tx here
function dbGetEntriesByFeedId(tx, feedId) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGetEntries(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbGetUnarchivedReadEntries(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_UNARCHIVED_STATE, ENTRY_READ_STATE];
    const request = index.getAll(key_path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance.
// TODO: internally the parameter to getAll might be (offset+limit)
function dbGetUnarchivedUnreadEntries(conn, offset, limit) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = () => resolve(entries);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_UNARCHIVED_STATE, ENTRY_UNREAD_STATE];
    const request = index.openCursor(keyPath);
    request.onsuccess = (event) => {
      const cursor = event.target.result;
      if(!cursor)
        return;
      if(offset && !advanced) {
        advanced = true;
        cursor.advance(offset);
        return;
      }
      entries.push(cursor.value);
      if(limited && ++counter < limit)
        cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

function dbFindEntryById(conn, id) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const request = tx.objectStore('entry').get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function dbCountUnreadEntries(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_UNREAD_STATE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: tx can't be exposed as it is leaky abstraction?
// TODO: allow for undefined chan
// @param tx {IDBTransaction}
// @param id {int}
// @param chan {BroadcastChannel}
function dbRemoveEntry(tx, id, chan) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      resolve();
      chan.postMessage({'type': 'entryDeleted', 'id': id});
    };
    request.onerror = () => reject(request.error);
  });
}

async function dbRemoveEntries(conn, ids, chan) {
  const tx = conn.transaction('entry', 'readwrite');
  const proms = ids.map((id) => dbRemoveEntry(tx, id, chan));
  return await Promise.all(proms);
}


// TODO: deprecate in favor of put, and after moving sanitization and
// default props out, maybe make a helper function in pollfeeds that does this
// TODO: ensure entries added by put, if not have id, have unread flag
// and date created
// TODO: this should be nothing other than putting. Caller is responsible
// for sanitizing and setting defaults.
function dbAddEntry(conn, entry) {
  return new Promise((resolve, reject) => {
    if('id' in entry)
      return reject(new TypeError());
    const sanitized = jrSanitizeEntry(entry);
    const storable = jrUtilsFilterEmptyProps(sanitized);
    storable.readState = ENTRY_UNREAD_STATE;
    storable.archiveState = ENTRY_UNARCHIVED_STATE;
    storable.dateCreated = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.add(storable);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbPutEntry(conn, entry) {
  const tx = conn.transaction('entry', 'readwrite');
  return await dbPutEntryWithTx(tx, entry);
}


// TODO: it should be callers responsibility to set dateUpdated, this should
// just put the entry as is
// TODO: probably should not bother with sharing tx, should just use separate
// txs, and then deal with optimizing put all if it is an perf issue. Integrity
// wise I am not sure it matters
// Resolves when the entry has been stored to the result of the request
// If entry.id is not set this will result in adding
// Sets dateUpdated before put. Impure.
// @param tx {IDBTransaction}
function dbPutEntryWithTx(tx, entry) {
  return new Promise((resolve, reject) => {
    entry.dateUpdated = new Date();
    const request = tx.objectStore('entry').put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Promise.all is failfast so this aborts if any one entry fails
async function dbPutEntries(conn, entries) {
  const tx = conn.transaction('entry', 'readwrite');
  const proms = entries.map((entry) => dbPutEntryWithTx(tx, entry));
  const putResolutionsArray = await Promise.all(proms);
  return putResolutionsArray;
}

// Resolves with a boolean indicating whether an entry with the given url
// was found in storage
// @param url {String}
function dbContainsEntryURL(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => reject(request.error);
  });
}
