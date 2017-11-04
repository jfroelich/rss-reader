'use strict';

// import base/assert.js
// import base/indexeddb.js
// import base/errors.js
// import net/fetch.js
// import net/url-utils.js
// import html.js

// 30 days in ms, used by both lookup and compact to determine whether a
// cache entry expired
const FAVICON_DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Opens a connection to the favicon database
// @returns {Promise} resolves to open IDBDatabase instance
function faviconDbOpen() {
  const name = 'favicon-cache';
  const version = 2;
  const timeoutMs = 500;
  return indexedDBOpen(name, version, faviconDbOnUpgradeNeeded, timeoutMs);
}

// TODO: rename to favicon_lookup_context, move out url and doc
function FaviconQuery() {
  // The indexedDB database connection to use for the lookup
  // @type {IDBDatabase}
  this.conn = null;

  // Optional pre-fetched HTML document to search prior to fetching
  // @type {Document}
  this.document = null;

  // The lookup url to find a favicon for
  // @type {URL}
  this.url = null;

  // If true, lookup will skip the fetch of the input url
  this.skipURLFetch = false;

  // These all store numbers
  this.maxAgeMs = undefined;
  this.fetchHTMLTimeoutMs = undefined;
  this.fetchImageTimeoutMs = undefined;

  // TODO: move defaults to here
  this.minImageSize = undefined;
  this.maxImageSize = undefined;
}

// Looks up the favicon url for a given web page url
// @param query {FaviconQuery}
// @returns {String} the favicon url if found, otherwise undefined
// TODO: make a member function of FaviconQuery named lookup, remove the query
// parameter
async function faviconLookup(query) {
  assert(query instanceof FaviconQuery);
  console.log('faviconLookup', query.url.href);

  // TODO: rather than declare local variables, just use the query parameter
  const urlObject = query.url;
  let maxAgeMs = query.maxAgeMs;
  let fetchHTMLTimeoutMs = query.fetchHTMLTimeoutMs;
  let fetchImageTimeoutMs = query.fetchImageTimeoutMs;
  let minImageSize = query.minImageSize;
  let maxImageSize = query.maxImageSize;

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = FAVICON_DEFAULT_MAX_AGE_MS;
  }

  if(typeof fetchHTMLTimeoutMs === 'undefined') {
    fetchHTMLTimeoutMs = 1000;
  }

  if(typeof fetchImageTimeoutMs === 'undefined') {
    fetchImageTimeoutMs = 200;
  }

  if(typeof minImageSize === 'undefined') {
    minImageSize = 50;
  }

  if(typeof maxImageSize === 'undefined') {
    maxImageSize = 10240;
  }

  // TODO: use an array
  const urls = new Set();
  urls.add(urlObject.href);

  // Check the cache for the input url
  if(query.conn) {
    const iconURLString = await faviconDbFindLookupURL(query.conn,
      query.url, maxAgeMs);
    if(iconURLString) {
      return iconURLString;
    }
  }

  // If the query included a pre-fetched document, search it
  if(query.document) {
    console.debug('faviconLookup searching pre-fetched document for url',
      urlObject.href);
    const iconURLString = await faviconSearchDocument(document, query.conn,
      query.url, urls);
    if(iconURLString) {
      console.debug('faviconLookup found favicon in pre-fetched document',
        urlObject.href, iconURLString);
      return iconURLString;
    }
  }

  // Get the response for the url. Trap any fetch errors, a fetch error is
  // non-fatal to lookup.
  let response;

  // Only fetch if a pre-fetched document was not provided
  if(!query.document && !query.skipURLFetch) {
    try {
      response = await fetchHTML(urlObject.href, fetchHTMLTimeoutMs);
    } catch(error) {
      // Do not warn. Network errors appear in the console.
      // Do not exit early. A fetch error is non-fatal to lookup.
    }
  }

  if(response) {
    let responseURLObject;

    if(response.redirected) {
      responseURLObject = new URL(response.responseURL);
      urls.add(responseURLObject.href);

      // Check the cache for the redirect url
      if(query.conn) {
        const iconURLString = await faviconDbFindRedirectURL(query.conn,
          urlObject, response, maxAgeMs);

        // Return the cached favicon url for the redirect url
        if(iconURLString) {
          return iconURLString;
        }
      }
    }

    // Get the full text of the fetched document
    let text;
    try {
      text = await response.text();
    } catch(error) {
      console.warn(error);
    }

    if(text) {

      let document;
      try {
        document = htmlParseFromString(text);
      } catch(error) {
        if(error instanceof AssertionError) {
          throw error;
        } else {
          // Ignore parse error
        }
      }

      if(document) {
        const baseURL = responseURLObject ? responseURLObject : urlObject;
        const iconURLString = await faviconSearchDocument(document, query.conn,
          baseURL, urls);
        if(iconURLString) {
          return iconURLString;
        }
      }
    }
  }

  // Check the cache for the origin url
  if(query.conn && !urls.has(urlObject.origin)) {
    const iconURLString = await faviconDbFindOriginURL(query.conn,
      urlObject.origin, urls, maxAgeMs);
    if(iconURLString) {
      return iconURLString;
    }
  }

  // Check for /favicon.ico
  const iconURLString = await faviconLookupOrigin(query.conn, urlObject,
    urls, fetchImageTimeoutMs, minImageSize, maxImageSize);
  return iconURLString;
}

async function faviconDbFindLookupURL(conn, urlObject, maxAgeMs) {
  assert(indexedDBIsOpen(conn));

  const entry = await faviconDbFindEntry(conn, urlObject);
  if(!entry) {
    return;
  }

  const currentDate = new Date();
  if(faviconIsEntryExpired(entry, currentDate, maxAgeMs)) {
    return;
  }

  console.log('faviconDbFindLookupURL found cached entry',
    entry.pageURLString, entry.iconURLString);
  return entry.iconURLString;
}

async function faviconDbFindRedirectURL(conn, urlObject, response,
  maxAgeMs) {
  const responseURLObject = new URL(response.responseURL);
  const entry = await faviconDbFindEntry(conn, responseURLObject);
  if(!entry) {
    return;
  }

  const currentDate = new Date();
  if(faviconIsEntryExpired(entry, currentDate, maxAgeMs)) {
    return;
  }

  console.log('found redirect in cache', entry);
  const entries = [urlObject.href];
  await faviconDbPutEntries(conn, entry.iconURLString, entries);
  return entry.iconURLString;
}

// @param document {Document}
// @param conn {IDBDatabase}
// @param baseURLObject {URL}
// @param urls {Set}
// @returns {String} a favicon url
async function faviconSearchDocument(document, conn, baseURLObject, urls) {
  assert(document instanceof Document);
  assert(indexedDBIsOpen(conn));
  assert(URLUtils.isURL(baseURLObject));
  assert(urls);

  if(!document.head) {
    return;
  }

  let iconURLObject;

  // TODO: querySelectorAll on one selector instead?

  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

  for(let selector of selectors) {
    const element = document.head.querySelector(selector);
    if(!element) {
      continue;
    }

    // Avoid passing empty string to URL constructor
    let hrefString = element.getAttribute('href');
    if(!hrefString) {
      continue;
    }

    hrefString = hrefString.trim();
    if(!hrefString) {
      continue;
    }

    try {
      iconURLObject = new URL(hrefString, baseURLObject);
    } catch(error) {
      continue;
    }

    console.log('found favicon <link>', baseURLObject.href,
      iconURLObject.href);

    // TODO: move this out so that faviconSearchDocument is not async
    if(conn) {
      await faviconDbPutEntries(conn, iconURLObject.href, urls);
    }
    return iconURLObject.href;
  }
}

async function faviconDbFindOriginURL(conn, originURLString, urls, maxAgeMs) {
  const originURLObject = new URL(originURLString);
  const originEntry = await faviconDbFindEntry(conn, originURLObject);
  const currentDate = new Date();
  if(!originEntry) {
    return;
  }

  if(faviconIsEntryExpired(originEntry, currentDate, maxAgeMs)) {
    return;
  }

  console.log('Found non-expired origin entry in cache', originURLString,
    originEntry.iconURLString);

  // origin is not in urls, and we know it is distinct, existing, and fresh
  await faviconDbPutEntries(conn, originEntry.iconURLString, urls);
  return originEntry.iconURLString;
}

async function faviconLookupOrigin(conn, urlObject, urls, fetchImageTimeoutMs,
  minImageSize, maxImageSize) {
  const imageURLString = urlObject.origin + '/favicon.ico';
  const fetchPromise = fetchImageHead(imageURLString, fetchImageTimeoutMs);
  let response;
  try {
    response = await fetchPromise;
  } catch(error) {
    // This is spamming the console so disabled for now.
    // console.warn(error);
    return;
  }

  if(response.size === FETCH_UNKNOWN_CONTENT_LENGTH ||
    (response.size >= minImageSize && response.size <= maxImageSize)) {
    if(conn) {
      await faviconDbPutEntries(conn, response.responseURL, urls);
    }
    console.log('Found origin icon', urlObject.href, response.responseURL);
    return response.responseURL;
  }
}

async function faviconDbSetup() {
  let conn;
  try {
    conn = await faviconDbOpen();
  } finally {
    indexedDBClose(conn);
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
    console.log('faviconDbOnUpgradeNeeded creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }
}

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
function faviconIsEntryExpired(entry, currentDate, maxAgeMs) {
  const entryAgeMs = currentDate - entry.dateUpdated;
  return entryAgeMs > maxAgeMs;
}

function faviconDbClear(conn) {
  assert(indexedDBIsOpen(conn));
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
  assert(indexedDBIsOpen(conn));
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlObject.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function faviconDbFindExpiredEntries(conn, maxAgeMs) {
  assert(indexedDBIsOpen(conn));

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = FAVICON_DEFAULT_MAX_AGE_MS;
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
  assert(indexedDBIsOpen(conn));
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of pageURLs)
      store.delete(url);
  });
}

function faviconDbPutEntries(conn, iconURL, pageURLs) {
  assert(indexedDBIsOpen(conn));
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
      store.put(entry);
    }
  });
}

// Finds expired entries in the database and removes them
// @throws AssertionError
// @throws Error database related
async function faviconCompactDb(conn, maxAgeMs) {
  assert(indexedDBIsOpen(conn));

  // Allow errors to bubble
  const entries = await faviconDbFindExpiredEntries(conn, maxAgeMs);

  const urls = [];
  for(const entry of entries) {
    urls.push(entry.pageURLString);
  }

  // Allow errors to bubble
  await faviconDbRemoveEntriesWithURLs(conn, urls);
}
