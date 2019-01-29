import {assert, AssertionError} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as idb from '/src/idb.js';
import * as net from '/src/net.js';

const DEFAULT_NAME = 'favicon';
const DEFAULT_VERSION = 1;
const DEFAULT_TIMEOUT = new Deadline(500);

const ONE_MONTH_MS = 1000 * 60 * 60 * 24 * 30;
const DEFAULT_MAX_FAILURE_COUNT = 3;

export function LookupRequest() {
  this.url = undefined;
  this.timeout = INDEFINITE;
  this.document = undefined;
  this.conn = undefined;
  this.min_image_size = 30;
  this.max_image_size = 10240;
  this.max_failure_count = DEFAULT_MAX_FAILURE_COUNT;
}

export async function lookup(request) {
  assert(is_valid_lookup_request(request));

  assert(request.timeout instanceof Deadline);

  const conn = request.conn;
  const hostname = request.url.hostname;

  let entry = await find_entry(conn, hostname);
  if (entry && entry.icon_url && !entry_is_expired(entry)) {
    console.debug('Hit valid', hostname, entry.icon_url);
    return entry.icon_url;
  }

  if (entry && entry.failures > request.max_failure_count) {
    console.debug('Hit but invalid', hostname);
    return;
  }

  const icon_url = search_document(request.document);
  if (icon_url) {
    console.debug('Found favicon in document', icon_url);
    const entry = new Entry();
    entry.hostname = hostname;
    entry.icon_url = icon_url;
    const now = new Date();
    entry.expires = new Date(Date.now() + ONE_MONTH_MS);
    entry.failures = 0;

    await put_entry(conn, entry);
    return icon_url;
  }

  let response;
  try {
    response = await fetch_root_icon(request);
  } catch (error) {
    if (error instanceof AssertionError) {
      throw error;
    } else {
      // Ignore
    }
  }

  if (response) {
    console.debug('Found root icon', hostname, response.url);
    const entry = new Entry();
    entry.hostname = hostname;
    entry.icon_url = response.url;
    const now = new Date();
    entry.expires = new Date(Date.now() + ONE_MONTH_MS);
    entry.failures = 0;
    await put_entry(conn, entry);
    return response.url;
  }

  // Memoize a failed lookup
  console.debug(
      'lookup failed to hostname %s with failure count %d', hostname,
      (entry && entry.failures) ? entry.failures + 1 : 1);
  const failure = new Entry();
  failure.hostname = hostname;
  failure.failures = (entry && entry.failures) ? entry.failures + 1 : 1;
  failure.icon_url = entry ? entry.icon_url : undefined;
  const now = new Date();
  failure.expires = new Date(now.getTime() + 2 * ONE_MONTH_MS);
  await put_entry(conn, failure);
}

// Fetch /favicon.ico
async function fetch_root_icon(request) {
  const url = request.url;
  const min_size = request.min_image_size;
  const max_size = request.max_image_size;
  const timeout = request.timeout;

  const root_icon = new URL(url.origin + '/favicon.ico');

  const fetch_options = {method: 'head', timeout: timeout};

  // Call without catching errors
  const response = await net.fetch_image(root_icon, fetch_options);

  const content_length = response.headers.get('Content-Length');
  if (content_length) {
    const length = parseInt(content_length, 10);
    if (!isNaN(length)) {
      if (length < min_size || length > max_size) {
        throw new RangeError('Image byte size out of range ' + root_icon.href);
      }
    }
  }

  return response;
}

function search_document(document) {
  if (!document || !document.head) {
    return;
  }

  const selector = [
    'link[rel="icon"][href]', 'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');
  const links = document.head.querySelectorAll(selector);

  // Assume the document has a valid baseURI. Although we are not even using
  // that at the moment, for now we just trust the href is canonical (and a
  // defined string)
  if (links.length > 1) {
    return links[0].getAttribute('href');
  }
}

function entry_is_expired(entry) {
  return entry.expires && entry.expires <= new Date();
}

function is_valid_lookup_request(request) {
  if (!(request instanceof LookupRequest)) {
    return false;
  }

  if (request.conn && !(request.conn instanceof IDBDatabase)) {
    return false;
  }

  if (!(request.url instanceof URL)) {
    return false;
  }

  return true;
}

export function Entry() {
  this.hostname = undefined;
  this.icon_url = undefined;
  this.expires = undefined;
  this.failures = 0;
}

// Return a promise that resolves to a connection
export function open(
    name = DEFAULT_NAME, version = DEFAULT_VERSION, timeout = DEFAULT_TIMEOUT) {
  console.debug('favicon.open', name, version, timeout);
  return idb.open(name, version, on_upgrade_needed, timeout);
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
function find_entry(conn, hostname) {
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
function put_entry(conn, entry) {
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

export class RangeError extends Error {}
