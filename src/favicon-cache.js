'use strict';

// 30 days in ms, used by both lookup and compact to determine whether a
// cache entry expired
const FAVICON_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Opens a connection to the favicon database
function faviconDbOpen() {
  const name = 'favicon-cache';
  const version = 3;
  const timeoutMs = 500;
  return openDB(name, version, faviconDbOnUpgradeNeeded, timeoutMs);
}

async function faviconDbSetup() {
  let conn;
  try {
    conn = await faviconDbOpen();
  } finally {
    closeDB(conn);
  }
}

function faviconDbOnUpgradeNeeded(event) {
  const conn = event.target.result;
  console.log('creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    console.log('faviconDbOnUpgradeNeeded creating favicon-cache');

    store = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    console.debug('faviconDbOnUpgradeNeeded creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }

  if(event.oldVersion < 3) {
    console.debug('oldVersion < 3');
    // In the transition from 2 to 3, there are no changes. I am adding a non-indexed property.
  }
}

function faviconDbClear(conn) {
  assert(isOpenDB(conn));
  return new Promise(function(resolve, reject) {
    console.debug('faviconDbClear start');
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function faviconDbFindEntry(conn, urlObject) {
  assert(isOpenDB(conn));
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlObject.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function faviconDbFindExpiredEntries(conn, maxAgeMs) {
  assert(isOpenDB(conn));

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = FAVICON_MAX_AGE_MS;
  }

  return new Promise(function(resolve, reject) {
    let cutoffTimeMs = Date.now() - maxAgeMs;
    cutoffTimeMs = cutoffTimeMs < 0 ? 0 : cutoffTimeMs;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const cutoffDate = new Date(cutoffTimeMs);
    const range = IDBKeyRange.upperBound(cutoffDate);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });
}

function faviconDbRemoveEntriesWithURLs(conn, pageURLs) {
  assert(isOpenDB(conn));
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of pageURLs)
      store.delete(url);
  });
}

function faviconDbPutEntry(conn, entry) {
  assert(isOpenDB(conn));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function faviconDbPutEntries(conn, iconURL, pageURLs) {
  assert(isOpenDB(conn));
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    const currentDate = new Date();
    for(const url of pageURLs) {
      const entry = {};
      entry.pageURLString = url;
      entry.iconURLString = iconURL;
      entry.dateUpdated = currentDate;

      // TEMP: ISSUE #453
      // This is called at least in the case of storing a succesful origin lookup.
      // For every fetch success, reset the failure counter to 0.
      // When creating a new entry, initialize the failure counter to 0.
      entry.failureCount = 0;

      store.put(entry);
    }
  });
}

// Finds expired entries in the database and removes them
// @throws AssertionError
// @throws Error database related
async function faviconCompactDb(conn, maxAgeMs) {
  assert(isOpenDB(conn));

  // Allow errors to bubble
  const entries = await faviconDbFindExpiredEntries(conn, maxAgeMs);

  const urls = [];
  for(const entry of entries) {
    urls.push(entry.pageURLString);
  }

  // Allow errors to bubble
  await faviconDbRemoveEntriesWithURLs(conn, urls);
}
