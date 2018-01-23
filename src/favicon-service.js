import {detectURLChanged, fetchHTML, tfetch} from "/src/common/fetch-utils.js";
import {open as utilsOpen} from "/src/common/indexeddb-utils.js";
import {fromContentType as mimeFromContentType} from "/src/common/mime-utils.js";

// The favicon service provides the ability to lookup the url of a favicon for a given
// web page. Lookups can optionally be cached in a database so that future lookups
// resolve more quickly and avoid repeated network requests. The cache can be cleared
// or compacted for maintenance.

// TODO: decouple from all common libraries to provide a severe service boundary
// TODO: breakup the lookup function into smaller functions so it easier to read
// TODO: do tests after recent changes

const NAME = 'favicon-cache';
const VERSION = 3;
const OPEN_TIMEOUT = 500;

const MAX_AGE = 1000 * 60 * 60 * 24 * 30;
const MAX_FAILURE_COUNT = 2;
const SKIP_FETCH = false;
const FETCH_HTML_TIMEOUT = 5000;
const FETCH_IMAGE_TIMEOUT = 1000;
const MIN_IMAGE_SIZE = 50;
const MAX_IMAGE_SIZE = 10240;

function noop() {}

// A partial drop in replacement for console that helps avoid the need to check if console is
// defined every call to one of its methods. Only some methods supported.
const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};


// TODO: change lookup so that it only throws an exception in the event of a programming error,
// and not in other cases such as a fetch error. A database error would be a programming error.
// TODO: the url parameter should be separate from options
// TODO: the document parameter should be separate from options
// TODO: rather than max age approach, cached entries should specify their own lifetimes, and
// each new entry should get a default lifetime, and lookup caller should be able to provide
// a custom lifetime for any new entries

// Options:
//
// * console {Object} optional, a console object where logging information is sent. If not
// specified then a goes-nowhere-stub is used which effectively means no logging.
// * conn {IDBDatabase} optional, an open database connection to the favicon cache. If specified
// then the lookup will interact with the cache. If not specified then a cacheless lookup is done.
// * maxFailureCount {Number} optional, if the lookup detects that too many failures have been
// recorded in the cache then the lookup will exit early. If a cache is provided and the lookup
// fails then a corresponding failure will be recorded. Failures are aggregated by origin to limit
// the  amount of failure entries in the cache.
// * skipURLFetch {Boolean} optional, defaults to false, whether to skip attempting to fetch the
// html of the input url
// * maxAge {Number} optional, integer, defaults to a preset in defaults.js, the number of millis
// after which an entry is considered to have expired
// * fetchHTMLTimeout {Number} optional, integer, number of millis to wait before considering an
// attempt to fetch the html of a url a failure
// * fetchImageTimeout {Number} optional, integer, number of millis to wait before considering
// an attempt to fetch an image (response to HEAD request) is a failure
// * minImageSize {Number} optional, minimum size in bytes of an image for it to be considered
// a valid favicon
// * maxImageSize {Number} optional, maximum size in bytes of an image for it to be considered
// a valid favicon
// * url {URL} required, the url to lookup, typically some webpage
// * document {Document} optional, pre-fetched document that should be specified if the page
// was previously fetched

const defaultOptions = {
  maxFailureCount: MAX_FAILURE_COUNT,
  maxAge: MAX_AGE,
  skipURLFetch: SKIP_FETCH,
  fetchHTMLTimeout: FETCH_HTML_TIMEOUT,
  fetchImageTimeout: FETCH_IMAGE_TIMEOUT,
  minImageSize: MIN_IMAGE_SIZE,
  maxImageSize: MAX_IMAGE_SIZE,
  console: NULL_CONSOLE
};

// Lookup a favicon
export async function lookup(inputOptions) {

  // TODO: review Object.assign. I believe it is shallow but I've forgotten. Right now
  // document is a property and I do not want to be cloning it, just copying the reference
  // to it.

  // Merge options together. This treats inputOptions as immutable, and supplies defaults.
  const options = Object.assign({}, defaultOptions, inputOptions);

  assert(options.url instanceof URL);
  assert(typeof options.document === 'undefined' || options.document instanceof Document);
  options.console.log('Favicon lookup', options.url.href);

  const urls = [];
  urls.push(options.url.href);

  let originURL = new URL(options.url.origin);
  let originEntry;

  // Check the cache for the input url
  if(options.conn) {
    const entry = await findEntry(options.conn, options.url);
    if(entry && entry.iconURLString && !entryIsExpired(entry, options)) {
      return entry.iconURLString;
    }
    if(originURL.href === options.url.href && entry &&
      entry.failureCount >= options.maxFailureCount) {
      options.console.debug('Too many failures', options.url.href);
      return;
    }
  }

  // If specified, examine the pre-fetched document
  if(options.document) {
    const iconURL = await searchDocument(options, options.document, options.url);
    if(iconURL) {
      if(options.conn) {
        await putAll(options.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if we reached the max failure count for the input url's origin (if we did not already
  // do the check above because input itself was origin)
  if(options.conn && originURL.href !== options.url.href) {
    originEntry = await findEntry(options.conn, originURL);
    if(originEntry && originEntry.failureCount >= options.maxFailureCount) {
      options.console.debug('Exceeded max lookup failures', originURL.href);
      return;
    }
  }

  // Try and fetch the html for the url. Non-fatal.
  let response;
  if(!document && !options.skipURLFetch) {
    try {
      response = await fetchHTML(url, options.fetchHTMLTimeout);
    } catch(error) {
      options.console.debug(error);
    }
  }

  // Handle redirect
  let responseURL;
  if(response) {
    responseURL = new URL(response.url);

    if(detectURLChanged(url, responseURL)) {

      // Update origin url for later
      if(responseURL.origin !== url.origin) {
        originURL = new URL(responseURL.origin);
      }

      // Add response url to the set of distinct urls investigated
      urls.push(responseURL.href);

      // Check the cache for the redirected url
      if(options.conn) {
        let entry = await findEntry(options.conn, responseURL);
        if(entry && entry.iconURLString && !entryIsExpired(entry, options)) {
          await putAll(options.conn, [url.href], entry.iconURLString);
          return entry.iconURLString;
        }
      }
    }
  }

  // We will be re-using the document variable, so avoid any ambiguity between a parse failure and
  // whether a pre-fetched document was specified
  options.document = null;

  // Deserialize the html response. Error is not fatal.
  if(response) {
    try {
      const text = await response.text();
      options.document = parseHTML(text);
    } catch(error) {
      options.console.debug(error);
    }
  }

  // Search the document. Errors are not fatal.
  if(options.document) {
    const baseURL = responseURL ? responseURL : options.url;
    let iconURL;
    try {
      iconURL = await searchDocument(options, options.document, baseURL);
    } catch(error) {
      options.console.debug(error);
    }

    if(iconURL) {
      if(options.conn) {
        await putAll(options.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if the origin is in the cache if it is distinct
  if(options.conn && !urls.includes(originURL.href)) {
    originEntry = await findEntry(options.conn, originURL);
    if(originEntry) {
      if(originEntry.iconURLString && !entryIsExpired(originEntry, options)) {
        await putAll(options.conn, urls, originEntry.iconURLString);
        return originEntry.iconURLString;
      } else if(originEntry.failureCount >= options.maxFailureCount) {
        options.console.debug('Exceeded failure count', originURL.href);
        return;
      }
    }
  }

  if(!urls.includes(originURL.href)) {
    urls.push(originURL.href);
  }

  // Check root directory
  const baseURL = responseURL ? responseURL : options.url;
  const imageURL = new URL(baseURL.origin + '/favicon.ico');
  response = null;
  try {
    response = await fetchImage(imageURL, options.fetchImageTimeout, options.minImageSize,
      options.maxImageSize);
  } catch(error) {
    options.console.debug(error);
  }

  if(response) {
    if(options.conn) {
      await putAll(options.conn, urls, response.url);
    }
    return response.url;
  }

  // Conditionally record failed lookup
  if(options.conn) {
    onLookupFailure(options.conn, originURL, originEntry, options.maxFailureCount);
  }
}

function onLookupFailure(conn, originURL, originEntry, maxFailureCount) {
  if(originEntry) {
    const newEntry = {};
    newEntry.pageURLString = originEntry.pageURLString;
    newEntry.dateUpdated = new Date();
    newEntry.iconURLString = originEntry.iconURLString;
    if('failureCount' in originEntry) {
      if(originEntry.failureCount <= maxFailureCount) {
        newEntry.failureCount = originEntry.failureCount + 1;
        putEntry(conn, newEntry);
      }
    } else {
      newEntry.failureCount = 1;
      putEntry(conn, newEntry);
    }
  } else {
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    putEntry(conn, newEntry);
  }
}

function entryIsExpired(entry, options) {
  // Tolerate partially corrupted data
  if(!entry.dateUpdated) {
    options.console.warn('Entry missing date updated', entry);
    return false;
  }

  const currentDate = new Date();
  const entryAge = currentDate - entry.dateUpdated;

  // Tolerate partially corrupted data
  if(entryAge < 0) {
    options.console.warn('Entry date updated is in the future', entry);
    return false;
  }

  return entryAge > options.maxAge;
}

async function searchDocument(options, document, baseURL) {
  assert(document instanceof Document);

  const candidates = findCandidateURLs(document);
  if(!candidates.length) {
    return;
  }

  let urls = [];
  for(const url of candidates) {
    const canonical = resolveURLString(url, baseURL);
    if(canonical) {
      urls.push(canonical);
    }
  }

  if(!urls.length) {
    return;
  }

  const seen = [];
  const distinct = [];
  for(const url of urls) {
    if(!seen.includes(url.href)) {
      distinct.push(url);
      seen.push(url.href);
    }
  }
  urls = distinct;

  for(const url of urls) {
    try {
      const response = await fetchImage(url, options.fetchImageTimeout, options.minImageSize,
        options.maxImageSize);
      if(response) {
        return response.url;
      }
    } catch(error) {
      // ignore
    }
  }
}

function findCandidateURLs(document) {
  const candidates = [];
  if(!document.head) {
    return candidates;
  }

  const selector = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');

  const links = document.head.querySelectorAll(selector);
  for(const link of links) {
    const href = link.getAttribute('href');
    if(href) {
      candidates.push(href);
    }
  }

  return candidates;
}

export function open(name, version, timeout) {
  if(typeof name === 'undefined') {
    name = NAME;
  }

  if(typeof version === 'undefined') {
    version = VERSION;
  }

  if(typeof timeout === 'undefined') {
    timeout = OPEN_TIMEOUT;
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
  const cutoffTime = Date.now() - (options.maxAge || MAX_AGE);
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

function findEntry(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('favicon-cache');
    const store = txn.objectStore('favicon-cache');
    const request = store.get(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putEntry(conn, entry) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    const store = txn.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function putAll(conn, urlStrings, iconURLString) {
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

// TODO: think of a better name. it isn't obvious that this is a HEAD request. Or that it is
// restricted to the purpose of icons given that size constraints and mime constraints are
// built in. Something like sendIconHeadRequest
// TODO: despite moving in the size constraints and how convenient that is, now I am mixing
// together a few concerns. There is the pure concern of fetching mixed together with the
// additional constraint concern. Not sure how I feel about it.

// TODO: instead of returning undefined, return a fake Response object with the
// appropriate HTTP status error code.

async function fetchImage(url, timeout, minImageSize, maxImageSize) {
  const options = {method: 'head', timeout: timeout};
  const response = await tfetch(url, options);

  // Only accept responses with an image-like mime-type
  const contentType = response.headers.get('Content-Type');
  if(!contentType) {
    console.debug('Response missing content type', url.href);
    return;
  }
  const mimeType = mimeFromContentType(contentType);
  if(!mimeType) {
    console.debug('Invalid content type', contentType, url.href);
    return;
  }

  if(!mimeType.startsWith('image/') && mimeType !== 'application/octet-stream') {
    console.debug('Unacceptable mime type', mimeType, url.href);
    return;
  }

  // Only accept images of a certain size
  const size = parseInt(response.headers.get('Content-Length'), 10);
  if(Number.isInteger(size)) {
    if(size < minImageSize) {
      console.debug('Content length too small', size, url.href);
      return;
    }
    if(size > maxImageSize) {
      console.debug('Content length too large', size, url.href);
      return;
    }
  } else {
    // Allow unknown size
  }

  return response;
}

function assert(value, message) {
  if(!value) {
    throw new Error(message || 'Assertion error');
  }
}

function resolveURLString(url, baseURL) {
  assert(baseURL instanceof URL);
  if(typeof url === 'string' && url.trim()) {
    try {
      return new URL(url, baseURL);
    } catch(error) {
      // ignore
    }
  }
}

function parseHTML(text) {
  assert(typeof text === 'string');
  const parser = new DOMParser();
  const document = parser.parseFromString(text, 'text/html');
  const error = document.querySelector('parsererror');
  if(error) {
    throw new Error(error.textContent);
  }
  return document;
}
