import {fetch_html, tfetch, url_did_change} from '/src/fetch/fetch.js';
import {idb_open} from '/src/idb/idb.js';
import {mime_type_from_content_type} from '/src/mime/mime.js';

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

// A partial drop in replacement for console that helps avoid the need to check
// if console is defined every call to one of its methods. Only some methods
// supported.
const NULL_CONSOLE = {
  log: noop,
  warn: noop,
  debug: noop
};

// Options:
//
// * console {Object} optional, a console object where logging information is
// sent. If not specified then a goes-nowhere-stub is used which effectively
// means no logging.
// * conn {IDBDatabase} optional, an open database connection to the favicon
// cache. If specified then the lookup will interact with the cache. If not
// specified then a cacheless lookup is done.
// * maxFailureCount {Number} optional, if the lookup detects that too many
// failures have been recorded in the cache then the lookup will exit early. If
// a cache is provided and the lookup fails then a corresponding failure will be
// recorded. Failures are aggregated by origin to limit the  amount of failure
// entries in the cache.
// * skipURLFetch {Boolean} optional, defaults to false, whether to skip
// attempting to fetch the html of the input url
// * maxAge {Number} optional, integer, the
// number of millis after which an entry is considered to have expired
// * fetchHTMLTimeout {Number} optional, integer, number of millis to wait
// before considering an attempt to fetch the html of a url a failure
// * fetchImageTimeout {Number} optional, integer, number of millis to wait
// before considering an attempt to fetch an image (response to HEAD request) is
// a failure
// * minImageSize {Number} optional, minimum size in bytes of an image for it to
// be considered a valid favicon
// * maxImageSize {Number} optional, maximum size in bytes of an image for it to
// be considered a valid favicon
// * url {URL} required, the url to lookup, typically some webpage
// * document {Document} optional, pre-fetched document that should be specified
// if the page was previously fetched

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

// Lookup the favicon image url according to input options
export async function lookup(inputOptions) {
  const options = Object.assign({}, defaultOptions, inputOptions);

  assert(options.url instanceof URL);
  assert(
      typeof options.document === 'undefined' ||
      options.document instanceof Document);
  options.console.log('Favicon lookup', options.url.href);

  const urls = [];
  urls.push(options.url.href);

  let origin_url = new URL(options.url.origin);
  let origin_entry;

  // Check the cache for the input url
  if (options.conn) {
    const entry = await db_find_entry(options.conn, options.url);
    if (entry && entry.iconURLString && !entry_is_expired(entry, options)) {
      return entry.iconURLString;
    }
    if (origin_url.href === options.url.href && entry &&
        entry.failureCount >= options.maxFailureCount) {
      options.console.debug('Too many failures', options.url.href);
      return;
    }
  }

  // If specified, examine the pre-fetched document
  if (options.document) {
    // TODO: this is a string, not a url, rename var
    const icon_url =
        await search_document(options, options.document, options.url);
    if (icon_url) {
      if (options.conn) {
        await db_put_all(options.conn, urls, icon_url);
      }
      return icon_url;
    }
  }

  // Check if we reached the max failure count for the input url's origin (if we
  // did not already do the check above because input itself was origin)
  if (options.conn && origin_url.href !== options.url.href) {
    origin_entry = await db_find_entry(options.conn, origin_url);
    if (origin_entry && origin_entry.failureCount >= options.maxFailureCount) {
      options.console.debug('Exceeded max lookup failures', origin_url.href);
      return;
    }
  }

  // Try and fetch the html for the url. Non-fatal.
  let response;
  if (!document && !options.skipURLFetch) {
    try {
      response = await fetch_html(url, options.fetchHTMLTimeout);
    } catch (error) {
      options.console.debug(error);
    }
  }

  // Handle redirect
  let response_url;
  if (response) {
    response_url = new URL(response.url);

    if (url_did_change(url, response_url)) {
      // Update origin url for later
      if (response_url.origin !== url.origin) {
        origin_url = new URL(response_url.origin);
      }

      // Add response url to the set of distinct urls investigated
      urls.push(response_url.href);

      // Check the cache for the redirected url
      if (options.conn) {
        let entry = await db_find_entry(options.conn, response_url);
        if (entry && entry.iconURLString && !entry_is_expired(entry, options)) {
          await db_put_all(options.conn, [url.href], entry.iconURLString);
          return entry.iconURLString;
        }
      }
    }
  }

  // We will be re-using the document variable, so avoid any ambiguity between a
  // parse failure and whether a pre-fetched document was specified
  options.document = null;

  // Deserialize the html response. Error is not fatal.
  if (response) {
    try {
      const text = await response.text();
      options.document = html_parse(text);
    } catch (error) {
      options.console.debug(error);
    }
  }

  // Search the document. Errors are not fatal.
  if (options.document) {
    const base_url = response_url ? response_url : options.url;
    let icon_url;
    try {
      icon_url = await search_document(options, options.document, base_url);
    } catch (error) {
      options.console.debug(error);
    }

    if (icon_url) {
      if (options.conn) {
        await db_put_all(options.conn, urls, icon_url);
      }
      return icon_url;
    }
  }

  // Check if the origin is in the cache if it is distinct
  if (options.conn && !urls.includes(origin_url.href)) {
    origin_entry = await db_find_entry(options.conn, origin_url);
    if (origin_entry) {
      if (origin_entry.iconURLString &&
          !entry_is_expired(origin_entry, options)) {
        await db_put_all(options.conn, urls, origin_entry.iconURLString);
        return origin_entry.iconURLString;
      } else if (origin_entry.failureCount >= options.maxFailureCount) {
        options.console.debug('Exceeded failure count', origin_url.href);
        return;
      }
    }
  }

  if (!urls.includes(origin_url.href)) {
    urls.push(origin_url.href);
  }

  // Check root directory for favicon.ico
  const base_url = response_url ? response_url : options.url;
  const image_url = new URL(base_url.origin + '/favicon.ico');
  response = null;
  try {
    response = await image_fetch_head_and_validate(
        image_url, options.fetchImageTimeout, options.minImageSize,
        options.maxImageSize);
  } catch (error) {
    options.console.debug(error);
  }

  if (response) {
    if (options.conn) {
      await db_put_all(options.conn, urls, response.url);
    }
    return response.url;
  }

  // Conditionally record failed lookup
  if (options.conn) {
    lookup_onfailure(
        options.conn, origin_url, origin_entry, options.maxFailureCount);
  }
}

function lookup_onfailure(conn, origin_url, origin_entry, max_failure_count) {
  if (origin_entry) {
    const new_entry = {};
    new_entry.pageURLString = origin_entry.pageURLString;
    new_entry.dateUpdated = new Date();
    new_entry.iconURLString = origin_entry.iconURLString;
    if ('failureCount' in origin_entry) {
      if (origin_entry.failureCount <= max_failure_count) {
        new_entry.failureCount = origin_entry.failureCount + 1;
        db_put_entry(conn, new_entry);
      }
    } else {
      new_entry.failureCount = 1;
      db_put_entry(conn, new_entry);
    }
  } else {
    const new_entry = {};
    new_entry.pageURLString = origin_url.href;
    new_entry.iconURLString = undefined;
    new_entry.dateUpdated = new Date();
    new_entry.failureCount = 1;
    db_put_entry(conn, new_entry);
  }
}

function entry_is_expired(entry, options) {
  // Tolerate partially corrupted data
  if (!entry.dateUpdated) {
    options.console.warn('Entry missing date updated', entry);
    return false;
  }

  const current_date = new Date();
  const entry_age = current_date - entry.dateUpdated;

  // Tolerate partially corrupted data
  if (entry_age < 0) {
    options.console.warn('Entry date updated is in the future', entry);
    return false;
  }

  return entry_age > options.maxAge;
}

async function search_document(options, document, base_url) {
  assert(document instanceof Document);

  const candidates = find_candidate_urls(document);
  if (!candidates.length) {
    return;
  }

  let urls = [];
  for (const url of candidates) {
    const canonical = url_string_resolve(url, base_url);
    if (canonical) {
      urls.push(canonical);
    }
  }

  if (!urls.length) {
    return;
  }

  const seen = [];
  const distinct = [];
  for (const url of urls) {
    if (!seen.includes(url.href)) {
      distinct.push(url);
      seen.push(url.href);
    }
  }
  urls = distinct;

  for (const url of urls) {
    try {
      const response = await image_fetch_head_and_validate(
          url, options.fetchImageTimeout, options.minImageSize,
          options.maxImageSize);
      return response.url;
    } catch (error) {
      // ignore
    }
  }
}

function find_candidate_urls(document) {
  const candidates = [];
  if (!document.head) {
    return candidates;
  }

  const selector = [
    'link[rel="icon"][href]', 'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');

  const links = document.head.querySelectorAll(selector);
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href) {
      candidates.push(href);
    }
  }

  return candidates;
}

export function open(name, version, timeout) {
  if (typeof name === 'undefined') {
    name = NAME;
  }

  if (typeof version === 'undefined') {
    version = VERSION;
  }

  if (typeof timeout === 'undefined') {
    timeout = OPEN_TIMEOUT;
  }

  return idb_open(name, version, db_onupgradeneeded, timeout);
}

function db_onupgradeneeded(event) {
  const conn = event.target.result;
  console.log('Creating or upgrading database', conn.name);

  let store;
  if (!event.oldVersion || event.oldVersion < 1) {
    console.debug('Creating favicon-cache store');
    store = conn.createObjectStore('favicon-cache', {keyPath: 'pageURLString'});
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if (event.oldVersion < 2) {
    console.debug('Creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }

  // In the transition from 2 to 3, there were no changes
}

// Clears the favicon object store. Optionally specify open params, which are
// generally only needed for testing. The clear function returns immediately,
// after starting the operation, but prior to the operation completing. Returns
// a promise.
export function clear(options = {}) {
  return open(options.name, options.version, options.timeout).then(conn => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = _ => {
      console.log('Cleared favicon store');
    };
    txn.onerror = _ => {
      throw new Error(txn.error);
    };

    const store = txn.objectStore('favicon-cache');
    console.log('Clearing favicon store');
    store.clear();
    console.debug('Enqueuing close request for database', conn.name);
    conn.close();
  });
}

// Remove expired entries from the database. Optionally specify open params for
// testing, otherwise this connects to the default database. This returns
// immediately, prior to the operation completing. Returns a promise.
export async function compact(options = {}) {
  console.log('Compacting favicon store...');
  const cutoff_time = Date.now() - (options.maxAge || MAX_AGE);
  assert(cutoff_time >= 0);
  const cutoff_date = new Date(cutoff_time);

  return open(options.name, options.version, options.timeout).then(conn => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = _ => {
      console.log('Compacted favicon store');
    };
    txn.onerror = _ => {
      throw new Error(txn.error);
    };

    const store = txn.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const range = IDBKeyRange.upperBound(cutoff_date);
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        console.debug('Deleting favicon entry', cursor.value);
        cursor.delete();
        cursor.continue();
      }
    };
    conn.close();
  });
}

function db_find_entry(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('favicon-cache');
    const store = txn.objectStore('favicon-cache');
    const request = store.get(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function db_put_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    const store = txn.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function db_put_all(conn, url_strings, iconURLString) {
  return new Promise((resolve, reject) => {
    assert(Array.isArray(url_strings));
    assert(typeof iconURLString === 'string');

    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);

    const store = txn.objectStore('favicon-cache');
    const current_date = new Date();
    const entry = {
      pageURLString: null,
      iconURLString: iconURLString,
      dateUpdated: current_date,
      failureCount: 0
    };

    for (const url_string of url_strings) {
      entry.pageURLString = url_string;
      store.put(entry);
    }
  });
}

async function image_fetch_head_and_validate(
    url, timeout, min_image_size, max_image_size) {
  const options = {method: 'head', timeout: timeout};
  const response = await tfetch(url, options);
  assert(response_has_image_type(response));
  assert(response_is_in_range(response, min_image_size, max_image_size));
  return response;
}

function response_is_in_range(response, min_size, max_size) {
  assert(response instanceof Response);
  assert(Number.isInteger(min_size));
  assert(Number.isInteger(max_size));
  const content_len = response.headers.get('Content-Length');
  const size = parseInt(content_len, 10);
  return isNaN(size) || (size >= min_size && size <= max_size);
}

function response_has_image_type(response) {
  assert(response instanceof Response);
  const content_type = response.headers.get('Content-Type');
  if (content_type) {
    const mime_type = mime_type_from_content_type(content_type);
    if (mime_type) {
      return mime_type.startsWith('image/') ||
          mime_type === 'application/octet-stream';
    }
  }
  return false;
}

function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion error');
  }
}

function url_string_resolve(url_string, base_url) {
  assert(base_url instanceof URL);
  if (typeof url_string === 'string' && url_string.trim()) {
    try {
      return new URL(url_string, base_url);
    } catch (error) {
      // ignore
    }
  }
}

function html_parse(text) {
  assert(typeof text === 'string');
  const parser = new DOMParser();
  const document = parser.parseFromString(text, 'text/html');
  const error = document.querySelector('parsererror');
  if (error) {
    throw new Error(error.textContent);
  }
  return document;
}
