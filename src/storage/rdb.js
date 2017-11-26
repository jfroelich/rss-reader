import assert from "/src/assert.js";
import * as Entry from "/src/storage/entry.js";
import * as Feed from "/src/storage/feed.js";
import * as idb from "/src/utils/idb.js";
import isPosInt from "/src/utils/is-pos-int.js";
import {isValidURLString} from "/src/url/url-string.js";

// Module for interacting with the app indexedDB database

const NAME = 'reader';
const VERSION = 22;
const OPEN_TIMEOUT_MS = 500;

// Opens a connection to the reader-db database
// @return {Promise} a promise that resolves to an open database connection
export function open() {
  return idb.open(NAME, VERSION, onUpgradeNeeded, OPEN_TIMEOUT_MS);
}

export const close = idb.close;
export const isOpen = idb.isOpen;

// Create the reader-db database
export async function setup() {
  let conn;
  try {
    conn = await open();
  } finally {
    close(conn);
  }
}

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
export function onUpgradeNeeded(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feedStore, entryStore;
  const stores = conn.objectStoreNames;

  console.log('upgrading database %s to version %s from version', conn.name, conn.version,
    event.oldVersion);

  if(event.oldVersion < 20) {
    feedStore = conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
    entryStore = conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});
    feedStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});
    feedStore.createIndex('title', 'title');
    entryStore.createIndex('readState', 'readState');
    entryStore.createIndex('feed', 'feed');
    entryStore.createIndex('archiveState-readState', ['archiveState', 'readState']);
    entryStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  } else {
    feedStore = tx.objectStore('feed');
    entryStore = tx.objectStore('entry');
  }

  if(event.oldVersion < 21) {
    // Add magic to all older entries
    addEntryMagic(tx);
  }

  if(event.oldVersion < 22) {
    addFeedMagic(tx);
  }
}

// Expects the transaction to be writable (either readwrite or versionchange)
function addEntryMagic(tx) {
  console.debug('Adding entry magic');
  const store = tx.objectStore('entry');
  const getAllEntriesRequest = store.getAll();
  getAllEntriesRequest.onerror = function(event) {
    console.warn('Error adding entry magic', getAllEntriesRequest.error);
  };
  getAllEntriesRequest.onsuccess = function(event) {
    const entries = event.target.result;
    writeEntriesWithMagic(store, entries);
  };
}

function writeEntriesWithMagic(entryStore, entries) {
  for(const entry of entries) {
    entry.magic = Entry.ENTRY_MAGIC;
    entry.dateUpdated = new Date();
    entryStore.put(entry);
  }
}

function addFeedMagic(tx) {
  console.debug('Adding feed magic');
  const store = tx.objectStore('feed');
  const getAllFeedsRequest = store.getAll();
  getAllFeedsRequest.onerror = function(event) {
    console.warn('Error adding feed magic', getAllFeedsRequest.error);
  };
  getAllFeedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for(const feed of feeds) {
      feed.magic = Feed.FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}


// Returns feed id if a feed with the given url exists in the database
// @param conn {IDBDatabase}
// @param url {String}
export function findFeedIdByURL(conn, url) {
  assert(idb.isOpen(conn));
  assert(isValidURLString(url));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// @param conn {IDBDatabase}
export function countUnreadEntries(conn) {
  assert(idb.isOpen(conn));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Searches for and returns an entry object matching the id
// @param conn {IDBDatabase} an open database connection
// @param id {Number} id of entry to find
// @returns {Promise} a promise that resolves to an entry object, or undefined
// if no matching entry was found
export function findEntryById(conn, id) {
  assert(idb.isOpen(conn));
  assert(Entry.isValidId(id));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Returns an entry ID, not an entry, matching url
// @param conn {IDBDatabase}
// @param url {String}
export function findEntryByURL(conn, url) {
  assert(idb.isOpen(conn));
  assert(isValidURLString(url));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function findEntryIdsByFeedId(conn, feedId) {
  assert(idb.isOpen(conn));
  assert(Feed.isValidId(feedId));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function findFeedById(conn, feedId) {
  assert(idb.isOpen(conn));
  assert(Feed.isValidId(feedId));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}



// Returns a promise that resolves to an array of feed ids, or rejects with
// a database error
// @param conn {IDBDatabase}
export function getFeedIds(conn) {
  assert(idb.isOpen(conn));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Scans the entry object store for entries matching the predicate
// @param conn {IDBDatabase}
// @param predicate {Function} evaluated against each entry during scan,
// an entry is included in the output if true
// @param limit {Number} optional, if specified then must be an integer > 0,
// an upper bound on number of entries included in output
// @return {Promise} resolves to an array of entry objects, or rejects with
// a database-related error.
export function findEntries(conn, predicate, limit) {
  assert(idb.isOpen(conn));
  assert(typeof predicate === 'function');
  const limited = typeof limit !== 'undefined';
  if(limited) {
    assert(isPosInt(limit));
    assert(limit > 0);
  }

  return new Promise(function executor(resolve, reject) {
    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = function(event) {
      reject(tx.error);
    };
    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const request = store.openCursor();
    request.onsuccess = function requestOnsuccess(event) {
      const cursor = event.target.result;
      if(!cursor) {
        // Either no entries, or iterated all. Do not advance. Allow the
        // transaction to settle which allows the promise to settle.
        return;
      }

      const entry = cursor.value;
      if(predicate(entry)) {
        entries.push(entry);
        if(limited && entries.length === limit) {
          // Do not advance. Allow the transaction to settle which allows
          // the promise to settle.
          return;
        }
      }

      cursor.continue();
    };
  });
}

export function findArchivableEntries(conn, predicate, limit) {
  assert(idb.isOpen(conn));
  assert(typeof predicate === 'function');
  // TODO: rather than assert failure when limit is 0, resolve immediately with an empty array.
  // Limit is optional
  const limited = typeof limit !== 'undefined';
  if(limited) {
    assert(isPosInt(limit), '' + limit);
    assert(limit > 0);
  }

  // This does two layers of filtering. It would preferably be one layer but a three property index
  // involving a date gets complicated. Given the perf is not top priority this is acceptable for
  // now. The first filter layer is at the indexedDB level, and the second is the in memory
  // predicate. The first layer reduces the number of entries loaded by a large amount.

  return new Promise(function executor(resolve, reject) {
    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;
      if(predicate(entry)) {
        entries.push(entry);
        // Stop walking if limited and reached limit
        if(limited && (entries.length >= limit)) {
          return;
        }
      }

      cursor.continue();
    };
  });
}

export function getUnarchivedUnreadEntries(conn, offset, limit) {
  assert(idb.isOpen(conn));
  return new Promise(function executor(resolve, reject) {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = function(event) {
      resolve(entries);
    };
    tx.onerror = function(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function requestOnsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(limited && ++counter < limit) {
            cursor.continue();
          }
        }
      }
    };
  });
}



export class ConstraintError extends Error {
  constructor(message) {
    super(message);
  }
}

export class NotFoundError extends Error {
  constructor(key) {
    super('Object not found for key ' + key);
  }
}

export class InvalidStateError extends Error {
  constructor(message) {
    super(message);
  }
}
