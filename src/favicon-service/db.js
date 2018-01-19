import {open as utilsOpen} from "/src/common/indexeddb-utils.js";
import * as defaults from "/src/favicon-service/defaults.js";
import {assert} from "/src/favicon-service/utils.js";

// TODO: decouple from indexeddb-utils.js. maybe drop support for timeout

export function open(name, version, timeout) {
  if(typeof name === 'undefined') {
    name = defaults.NAME;
  }

  if(typeof version === 'undefined') {
    version = defaults.VERSION;
  }

  if(typeof timeout === 'undefined') {
    timeout = defaults.OPEN_TIMEOUT;
  }

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

// Clears the favicon object store. Optionally specify open params, which are generally only
// needed for testing. The clear function returns immediately, after starting the operation, but
// prior to the operation completing. Returns a promise.
export function clear(options = {}) {
  return open(options.name, options.version, options.timeout).then(conn => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = () => {
      console.log('Cleared favicon store');
    };
    txn.onerror = () => {
      throw new Error(txn.error);
    };

    const store = txn.objectStore('favicon-cache');
    console.log('Clearing favicon store');
    store.clear();
    console.debug('Enqueuing close request for database', conn.name);
    conn.close();
  });
}

// Remove expired entries from the database. Optionally specify open params for testing, otherwise
// this connects to the default database. This returns immediately, prior to the operation
// completing. Returns a promise.
export async function compact(options = {}) {
  console.log('Compacting favicon store...');
  const cutoffTime = Date.now() - (options.maxAge || defaults.MAX_AGE);
  assert(cutoffTime >= 0);
  const cutoffDate = new Date(cutoffTime);

  return open(options.name, options.version, options.timeout).then(conn => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = () => {
      console.log('Compacted favicon store');
    };
    txn.onerror = () => {
      throw new Error(txn.error);
    };

    const store = txn.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const range = IDBKeyRange.upperBound(cutoffDate);
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if(cursor) {
        console.debug('Deleting favicon entry', cursor.value);
        cursor.delete();
        cursor.continue();
      }
    };
    conn.close();
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
    const entry = {
      pageURLString: null,
      iconURLString: iconURLString,
      dateUpdated: currentDate,
      failureCount: 0
    };

    for(const urlString of urlStrings) {
      entry.pageURLString = urlString;
      store.put(entry);
    }
  });
}
