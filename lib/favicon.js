import assert from '/lib/assert.js';
import {is_assert_error} from '/lib/assert.js';
import {AcceptError} from '/lib/better-fetch.js';
import {better_fetch} from '/lib/better-fetch.js';
import {Deadline, INDEFINITE} from '/lib/deadline.js';
import * as indexeddb_utils from '/lib/indexeddb-utils.js';
import * as mime from '/lib/mime-utils.js';

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
  this.expires = new Date(Date.now() + ONE_MONTH_MS);
  this.max_failure_count = DEFAULT_MAX_FAILURE_COUNT;
}

export async function lookup(request) {
  assert(request instanceof LookupRequest);
  assert(request.conn === undefined || request.conn instanceof IDBDatabase);
  assert(request.url instanceof URL);
  assert(request.timeout instanceof Deadline);
  assert(request.expires instanceof Date);

  const lookup_date = new Date();
  let entry = await find_entry(request.conn, request.url);
  if (entry && entry.icon_url && entry.expires >= lookup_date) {
    return new URL(entry.icon_url);
  }

  if (entry && entry.failures > request.max_failure_count) {
    return;
  }

  const icon_url = search_document(request.document);
  if (icon_url) {
    const entry = new Entry();
    entry.hostname = request.url.hostname;
    entry.icon_url = icon_url.href;
    entry.expires = request.expires;
    entry.failures = 0;

    await put_entry(request.conn, entry);
    return icon_url;
  }

  let response;
  try {
    response = await fetch_root_icon(request);
  } catch (error) {
    if (is_assert_error(error)) {
      throw error;
    } else {
      // Ignore
      console.debug(error.message);
    }
  }

  if (response) {
    const entry = new Entry();
    entry.hostname = request.url.hostname;
    entry.icon_url = response.url;
    entry.expires = request.expires;
    entry.failures = 0;
    await put_entry(request.conn, entry);
    return new URL(response.url);
  }

  // Memoize a failed lookup
  const failure = new Entry();
  failure.hostname = request.url.hostname;
  failure.failures = (entry && entry.failures) ? entry.failures + 1 : 1;
  failure.icon_url = entry ? entry.icon_url : undefined;
  failure.expires = new Date(request.expires.getTime() * 2);
  await put_entry(request.conn, failure);
}

// Fetch /favicon.ico
async function fetch_root_icon(request) {
  const url = request.url;
  const min_size = request.min_image_size;
  const max_size = request.max_image_size;
  const timeout = request.timeout;
  const root_icon = new URL(url.origin + '/favicon.ico');

  // NOTE: oracle.com returns "unknown" as the content type, which is why this
  // is not restricted by content-type, despite my preference.
  const fetch_options = {method: 'head', timeout: timeout};

  // Call without catching errors
  const response = await fetch_image(root_icon, fetch_options);

  const content_length = response.headers.get('Content-Length');
  if (content_length) {
    const length = parseInt(content_length, 10);
    if (!isNaN(length)) {
      if (length < min_size || length > max_size) {
        throw new RangeError('Image byte size out of range ' + root_icon.href);
      }
    }
  }

  const accepted_types = [
    'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
    'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
    'image/vnd.microsoft.icon'
  ];

  const content_type = response.headers.get('Content-Type');
  const mime_type = mime.parse_content_type(content_type);
  if (mime_type && !accepted_types.includes(mime_type)) {
    const message =
        'Unacceptable type ' + mime_type + ' for url ' + root_icon.href;
    throw new AcceptError(message);
  }

  return response;
}

// Returns a URL (not a url string). Currently this is naive and just returns
// the first one found in document order. For convenience, this accepts an
// undefined document and simply exits if undefined.
// TODO: stricter is better, require document to be defined
function search_document(document) {
  if (!document || !document.head) {
    return;
  }

  // TODO: assert that the document has a custom base uri, perhaps by asserting
  // that there is a valid base element present?

  const selector = [
    'link[rel="icon"][href]', 'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');
  const links = document.head.querySelectorAll(selector);

  if (links.length > 1) {
    // TODO: review whether it is possible to access link.href which implicitly
    // is the absolute url that uses baseURI

    return new URL(links[0].getAttribute('href'), document.baseURI);
  }
}

// exported only for testing
export function fetch_image(url, options) {
  return better_fetch(url, options);
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
  return indexeddb_utils.open(name, version, on_upgrade_needed, timeout);
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

// Find and return an entry corresponding to the given url. This does
// not check if the entry is expired. |conn| is optional and must be either
// undefined or of type IDBDatabase. |url| is type URL.
export function find_entry(conn, url) {
  return new Promise((resolve, reject) => {
    if (conn) {
      assert(conn instanceof IDBDatabase);
    } else {
      resolve();
      return;
    }
    assert(url instanceof URL);

    const txn = conn.transaction('entries');
    const store = txn.objectStore('entries');
    const request = store.get(url.hostname);
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
      return reject(new TypeError('Invalid entry ' + entry));
    }

    if (typeof entry.hostname !== 'string' || entry.hostname.length < 1) {
      return reject(new TypeError('Entry has invalid hostname ' + entry));
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

export class RangeError extends Error {
  constructor(message = 'Out of range') {
    super(message);
  }
}
