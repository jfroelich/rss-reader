import assert from '/src/base/assert.js';
import * as indexeddb from '/src/base/indexeddb.js';

// NOTE: this file is undergoing development and is unstable!!!! DO NOT USE!

// This module provides storage functionality for the favicon service.
//
// This module is considered private to favicon-service.js and its test module.
// Do not directly import this module. Only access cache functionality via the
// service.


const DEFAULT_NAME = 'favicon';
const DEFAULT_VERSION = 1;
const DEFAULT_TIMEOUT = 500;

export function Entry() {
  this.origin = undefined;
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
    store = conn.createObjectStore('entries', {keyPath: 'origin'});
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

// Removes expired entries from the database
// NOTE: unsure how this will look. For now I am focusing on using the new
// expires property approach.
// TODO: the lookup code should check expires and consider uncached if expired,
// so that it avoids finding expired-but-not-yet-cleared entries, because the
// lookup should not be concerned with removing expired and paying that cost
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
      if (entry.expires && entry.expires > now) {
        console.debug('Deleting expired entry', entry);
        cursor.delete();
      }

      cursor.continue();
    };
  });
}

// Find and return an entry corresponding to the given origin. Note this does
// not care if expired. |origin| must be a URL.
export function find_entry(conn, origin) {
  return new Promise((resolve, reject) => {
    // For convenience, no-op disconnected checks
    if (!conn) {
      resolve();
      return;
    }

    if (!origin || !origin.href) {
      reject(new TypeError('Invalid origin ' + origin));
      return;
    }

    const txn = conn.transaction('entries');
    const store = txn.objectStore('entries');
    const request = store.get(origin.href);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

export function put_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    if (!conn) {
      resolve();
      return;
    }

    if (!entry || typeof entry !== 'object') {
      return reject(new TypeError('Invalid entry parameter ' + entry));
    }

    if (!entry.origin) {
      return reject(new TypeError('Missing origin property ' + entry));
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
