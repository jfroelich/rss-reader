import assert from "/src/assert.js";
import * as Entry from "/src/storage/entry.js";
import * as Feed from "/src/storage/feed.js";
import * as idb from "/src/utils/idb.js";
import isPosInt from "/src/utils/is-pos-int.js";
import {isValidURLString} from "/src/url/url-string.js";

// Module for interacting with the app indexedDB database

// TODO: break up into individual files as there is too little coherency here
// TODO: rename "/storage/" folder to "/db/" or "/reader-db/"

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
