import assert from '/src/base/assert.js';
import * as indexeddb from '/src/base/indexeddb.js';

// This module provides persistence for favicon.js. This should be considered
// private to favicon.js and its test module. Do not directly import.

const DEFAULT_NAME = 'favicon';
const DEFAULT_VERSION = 1;
const DEFAULT_TIMEOUT = 500;

export function Entry() {
  this.hostname = undefined;
  this.icon_url = undefined;
  this.expires = undefined;
  this.failures = 0;
}

// Return a promise that resolves to a connection
export function open(
    name = DEFAULT_NAME, version = DEFAULT_VERSION, timeout = DEFAULT_TIMEOUT) {
  return indexeddb.open(name, version, on_upgrade_needed, timeout);
}

// Create or upgrade the database
function on_upgrade_needed(event) {
  const request = event.target;
  const conn = request.result;
  const txn = request.transaction;

  if (event.oldVersion) {
    console.debug(
        'Upgrading database from %d to %d', event.oldVersion, conn.version);
  } else {
    console.debug('Creating database with version %d', conn.version);
  }

  // This code does not make use of store at the moment, but its coded so as to
  // be easy to extend.
  let store;
  if (event.oldVersion) {
    store = txn.objectStore('entries');
  } else {
    store = conn.createObjectStore('entries', {keyPath: 'hostname'});
  }
}

// Remove all data from the database
export function clear(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entries', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entries').clear();
  });
}

// Remove expired entries from the database
export function compact(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entries', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = store.openCursor();
    const now = new Date();
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) {
        return;
      }
      const entry = cursor.value;
      if (entry.expires && entry.expires <= now) {
        cursor.delete();
      }
      cursor.continue();
    };
  });
}

// Find and return an entry corresponding to the given hostname. Note this does
// not care if expired. |hostname| must be a string.
export function find_entry(conn, hostname) {
  return new Promise((resolve, reject) => {
    // For convenience, no-op disconnected checks
    if (!conn) {
      resolve();
      return;
    }

    if (typeof hostname !== 'string' || hostname.length < 1) {
      reject(new TypeError('Invalid hostname ' + hostname));
      return;
    }

    const txn = conn.transaction('entries');
    const store = txn.objectStore('entries');
    const request = store.get(hostname);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

// Create or replace an entry in the cache
export function put_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    if (!conn) {
      resolve();
      return;
    }

    if (!entry || typeof entry !== 'object') {
      return reject(new TypeError('Invalid entry parameter ' + entry));
    }

    if (typeof entry.hostname !== 'string' || entry.hostname.length < 1) {
      return reject(new TypeError('Entry missing hostname ' + entry));
    }

    let result;
    const txn = conn.transaction('entries', 'readwrite');
    txn.oncomplete = _ => resolve(result);
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entries');
    const request = store.put(entry);
    request.onsuccess = _ => result = request.result;
  });
}
