import * as indexedDBUtils from '/lib/indexeddb-utils.js';
import * as mime from '/lib/mime-utils.js';
import { AcceptError, betterFetch } from '/lib/better-fetch.js';
import { Deadline, INDEFINITE } from '/lib/deadline.js';
import assert, { isAssertError } from '/lib/assert.js';

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
  this.minImageSize = 30;
  this.maxImageSize = 10240;
  this.expires = new Date(Date.now() + ONE_MONTH_MS);
  this.maxFailureCount = DEFAULT_MAX_FAILURE_COUNT;
}

export async function lookup(request) {
  assert(request instanceof LookupRequest);
  assert(request.conn === undefined || request.conn instanceof IDBDatabase);
  assert(request.url instanceof URL);
  assert(request.timeout instanceof Deadline);
  assert(request.expires instanceof Date);

  const lookupDate = new Date();
  const entry = await findEntry(request.conn, request.url);
  if (entry && entry.icon_url && entry.expires >= lookupDate) {
    return new URL(entry.icon_url);
  }

  if (entry && entry.failures > request.maxFailureCount) {
    return undefined;
  }

  const iconURL = searchDocument(request.document);
  if (iconURL) {
    const entry = new Entry();
    entry.hostname = request.url.hostname;
    entry.icon_url = iconURL.href;
    entry.expires = request.expires;
    entry.failures = 0;

    await putEntry(request.conn, entry);
    return iconURL;
  }

  let response;
  try {
    response = await fetchRootIcon(request);
  } catch (error) {
    if (isAssertError(error)) {
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
    await putEntry(request.conn, entry);
    return new URL(response.url);
  }

  // Memoize a failed lookup
  const failure = new Entry();
  failure.hostname = request.url.hostname;
  failure.failures = (entry && entry.failures) ? entry.failures + 1 : 1;
  failure.icon_url = entry ? entry.icon_url : undefined;
  failure.expires = new Date(request.expires.getTime() * 2);
  await putEntry(request.conn, failure);

  return undefined;
}

// Fetch /favicon.ico
async function fetchRootIcon(request) {
  const {
    url, minImageSize, maxImageSize, timeout
  } = request;
  const rootIcon = new URL(`${url.origin}/favicon.ico`);

  // NOTE: oracle.com returns "unknown" as the content type, which is why this
  // is not restricted by content-type, despite my preference.
  const fetchOptions = { method: 'head', timeout };

  // Call without catching errors
  const response = await fetchImage(rootIcon, fetchOptions);

  const contentLength = response.headers.get('Content-Length');
  if (contentLength) {
    const length = parseInt(contentLength, 10);
    if (!isNaN(length)) {
      if (length < minImageSize || length > maxImageSize) {
        throw new RangeError(`Image byte size out of range ${rootIcon.href}`);
      }
    }
  }

  const acceptedMimeTypes = [
    'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
    'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
    'image/vnd.microsoft.icon'
  ];

  const contentType = response.headers.get('Content-Type');
  const mimeType = mime.parseContentType(contentType);
  if (mimeType && !acceptedMimeTypes.includes(mimeType)) {
    throw new AcceptError(`Unacceptable type ${mimeType} for url ${rootIcon.href}`);
  }

  return response;
}

// Returns a URL (not a url string). Currently this is naive and just returns
// the first one found in document order. For convenience, this accepts an
// undefined document and simply exits if undefined.
// TODO: stricter is better, require document to be defined
function searchDocument(document) {
  if (!document || !document.head) {
    return undefined;
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

  return undefined;
}

// exported only for testing
export function fetchImage(url, options) {
  return betterFetch(url, options);
}

export function Entry() {
  this.hostname = undefined;
  this.icon_url = undefined;
  this.expires = undefined;
  this.failures = 0;
}

// Return a promise that resolves to a connection
export function open(
  name = DEFAULT_NAME, version = DEFAULT_VERSION, timeout = DEFAULT_TIMEOUT,
) {
  return indexedDBUtils.open(name, version, onUpgradeNeeded, timeout);
}

// Create or upgrade the database
function onUpgradeNeeded(event) {
  const request = event.target;
  const conn = request.result;

  if (event.oldVersion) {
    console.debug('Upgrading database from %d to %d', event.oldVersion, conn.version);
  } else {
    console.debug('Creating database with version %d', conn.version);
  }

  conn.createObjectStore('entries', { keyPath: 'hostname' });
}

// Remove all data from the database
export function clear(conn) {
  return new Promise((resolve, reject) => {
    const transaction = conn.transaction('entries', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onerror = event => reject(event.target.error);
    transaction.objectStore('entries').clear();
  });
}

// Remove expired entries from the database
export function compact(conn) {
  return new Promise((resolve, reject) => {
    const transaction = conn.transaction('entries', 'readwrite');
    transaction.oncomplete = resolve;
    transaction.onerror = event => reject(event.target.error);
    const store = transaction.objectStore('entries');
    const request = store.openCursor();
    const now = new Date();
    request.onsuccess = (event) => {
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
export function findEntry(conn, url) {
  return new Promise((resolve, reject) => {
    if (conn) {
      assert(conn instanceof IDBDatabase);
    } else {
      resolve();
      return;
    }
    assert(url instanceof URL);

    const transaction = conn.transaction('entries');
    const store = transaction.objectStore('entries');
    const request = store.get(url.hostname);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Create or replace an entry in the cache
export function putEntry(conn, entry) {
  return new Promise((resolve, reject) => {
    if (!conn) {
      resolve();
      return undefined;
    }

    if (!entry || typeof entry !== 'object') {
      return reject(new TypeError(`Invalid entry ${entry}`));
    }

    if (typeof entry.hostname !== 'string' || entry.hostname.length < 1) {
      return reject(new TypeError(`Entry has invalid hostname ${entry}`));
    }

    let result;

    const transaction = conn.transaction('entries', 'readwrite');
    transaction.oncomplete = function transactionOncomplete() {
      resolve(result);
    };
    transaction.onerror = event => reject(event.target.error);

    const store = transaction.objectStore('entries');
    const request = store.put(entry);
    request.onsuccess = function requestOnsuccess() {
      const requestResult = request.result;
      result = requestResult;
    };

    return undefined;
  });
}

export class RangeError extends Error {
  constructor(message = 'Out of range') {
    super(message);
  }
}
