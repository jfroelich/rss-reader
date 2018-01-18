import {open as utilsOpen} from "/src/common/indexeddb-utils.js";
import {MAX_AGE} from "/src/favicon-service/defaults.js";
import {assert} from "/src/favicon-service/utils.js";

// TODO: decouple from indexeddb-utils.js. maybe drop support for timeout

export async function open(name = 'favicon-cache', version = 3, timeout = 500) {
  return utilsOpen(name, version, onUpgradeNeeded, timeout);
}

function onUpgradeNeeded(event) {
  const conn = event.target.result;
  console.log('Creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    console.debug('Creating favicon-cache store');
    store = conn.createObjectStore('favicon-cache', {keyPath: 'pageURLString'});
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    console.debug('Creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }

  // In the transition from 2 to 3, there were no changes
}

// TODO: I am not sure if the promise helper is even needed. close can be called while
// transactions pending. There may be no need to wait for the operation to complete.

// Clears the favicon object store.
// @param conn {IDBDatabase} optional open database connection, a connection is dynamically
// created, used, and closed, if not specified
export async function clear(conn) {
  console.log('Clearing favicon store');
  const dconn = conn ? conn : await open();
  await clearPromise(dconn);
  if(!conn) {
    dconn.close();
  }
  console.log('Cleared favicon store');
}

function clearPromise(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    const store = txn.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: do I even need a promise helper? why wait for the operation to complete? conn.close
// doesn't need to wait.
// @param conn {IDBDatabase} optional, otherwise created dynamically
export async function compact(conn) {
  console.log('Compacting favicon store...');
  const cutoffTime = Date.now() - MAX_AGE;
  assert(cutoffTime >= 0);
  const cutoffDate = new Date(cutoffTime);

  const dconn = conn ? conn : await open();
  const count = await compactPromise(dconn, cutoffDate);
  if(!conn) {
    dconn.close();
  }

  console.log('Compacted favicon store, deleted %d entries', count);
}

// Query for expired entries and delete them
function compactPromise(conn, cutoffDate) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = () => resolve(count);
    txn.onerror = () => reject(txn.error);
    const store = txn.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const range = IDBKeyRange.upperBound(cutoffDate);
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if(cursor) {
        console.debug('Deleting expired favicon entry', cursor.value);
        count++;
        cursor.delete();
        cursor.continue();
      }
    };
  });
}

export function findEntry(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('favicon-cache');
    const store = txn.objectStore('favicon-cache');
    const request = store.get(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function putEntry(conn, entry) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    const store = txn.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function putAll(conn, urlStrings, iconURLString) {
  return new Promise((resolve, reject) => {
    assert(Array.isArray(urlStrings));
    assert(typeof iconURLString === 'string');

    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);

    const store = txn.objectStore('favicon-cache');
    const currentDate = new Date();

    for(const urlString of urlStrings) {
      const entry = {
        pageURLString: urlString,
        iconURLString: iconURLString,
        dateUpdated: currentDate,
        failureCount: 0
      };

      store.put(entry);
    }
  });
}
