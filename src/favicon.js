// See license.md

'use strict';

{ // Begin file block scope

// 30 days in ms, used by both lookup and compact
const defaultMaxAgeMillis = 1000 * 60 * 60 * 24 * 30;

// Looks up the favicon url for a given web page url
// @param conn {IDBDatabase} optional, an open indexedDB connection, if
// undefined a cacheless lookup is performed
// @param urlObject {URL} the url of a webpage to lookup
// @param maxAgeMillis {Number} optional, the amount of time before entries in
// the cache are considered expired, defaults to 30 days
// @param fetchHTMLTimeoutMillis {Number} optional, the amount of timed allowed
// to elapse before considering a fetch for a document to have failed, defaults
// to 1000 milliseconds.
// @param fetchImageTimeoutMillis {Number} optional, the amount of time allowed
// to elapse before considering a fetch for an image to have failed, defaults to
// 200 milliseconds.
// @param minImageByteSize {Number} optional, if the remote server reports the
// image as less than or equal to this size then the candidate is rejected,
// defaults to 50 bytes.
// @param maxImageByteSize {Number} optional, if the remote server reports the
// image as greater than or equal to this size then the candidate is rejected,
// defaults to 10240 bytes.
// @param verbose {Boolean} if true then log various messages
// @returns {String} the favicon url if found, otherwise undefined
async function lookupFavicon(conn, urlObject, maxAgeMillis,
  fetchHTMLTimeoutMillis, fetchImageTimeoutMillis, minImageByteSize,
  maxImageByteSize, verbose) {

  if(verbose) {
    console.log('LOOKUP', urlObject.href);
  }
  if(typeof maxAgeMillis === 'undefined') {
    maxAgeMillis = defaultMaxAgeMillis;
  }

  if(typeof fetchHTMLTimeoutMillis === 'undefined') {
    fetchHTMLTimeoutMillis = 1000;
  }

  if(typeof fetchImageTimeoutMillis === 'undefined') {
    fetchImageTimeoutMillis = 200;
  }

  if(typeof minImageByteSize === 'undefined') {
    minImageByteSize = 50;
  }

  if(typeof maxImageByteSize === 'undefined') {
    maxImageByteSize = 10240;
  }

  // TODO: maybe this is always overkill and not needed
  const urls = new Set();
  urls.add(urlObject.href);

  // Step 1: check the cache for the input url
  if(conn) {
    const iconURLString = await findLookupURLInCache(conn, urlObject,
      maxAgeMillis, verbose);
    if(iconURLString) {
      return iconURLString;
    }
  }

  const response = await fetchDocumentSilently(urlObject,
    fetchHTMLTimeoutMillis, verbose);
  if(response) {
    // Step 2: check the cache for the redirect url
    if(conn && response.redirected) {
      const responseURLObject = new URL(response.responseURLString);
      urls.add(responseURLObject.href);
      const iconURLString = await findRedirectInCache(conn, urlObject,
        response, maxAgeMillis, verbose);
      if(iconURLString) {
        return iconURLString;
      }
    }

    // Step 3: check the fetched document for a <link> tag
    const iconURLString = await findIconInResponseText(conn, urlObject, urls,
      response, verbose);
    if(iconURLString) {
      return iconURLString;
    }
  }

  // Step 4: check the cache for the origin url
  if(conn && !urls.has(urlObject.origin)) {
    const iconURLString = await findOriginInCache(conn, urlObject.origin,
      urls, maxAgeMillis);
    if(iconURLString) {
      return iconURLString;
    }
  }

  // Step 5: check for /favicon.ico
  const iconURLString = await lookupOrigin(conn, urlObject, urls,
    fetchImageTimeoutMillis, minImageByteSize, maxImageByteSize, verbose);
  return iconURLString;
}

async function findLookupURLInCache(conn, urlObject, maxAgeMillis, verbose) {
  const entry = await findEntry(conn, urlObject);
  if(!entry) {
    return;
  }
  const currentDate = new Date();
  if(isEntryExpired(entry, currentDate, maxAgeMillis)) {
    return;
  }
  if(verbose) {
    console.log('Found favicon of input url in cache', entry);
  }
  return entry.iconURLString;
}

// @returns {String}
async function findRedirectInCache(conn, urlObject, response, maxAgeMillis,
  verbose) {
  const responseURLObject = new URL(response.responseURLString);
  const entry = await findEntry(conn, responseURLObject);
  if(!entry) {
    return;
  }
  const currentDate = new Date();
  if(isEntryExpired(entry, currentDate, maxAgeMillis)) {
    return;
  }
  if(verbose) {
    console.debug('Found redirect in cache', entry);
  }
  await putEntries(conn, entry.iconURLString, [urlObject.href]);
  return entry.iconURLString;
}

// @returns {String} a favicon url
async function findIconInResponseText(conn, urlObject, urls, response,
  verbose) {
  let document;
  try {
    const text = await response.text();
    document = parseHTML(text);
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
    return;
  }

  if(!document.head) {
    return;
  }

  const baseURLObject = response.redirected ?
    new URL(response.responseURLString) : urlObject;

  let iconURLObject;
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
    if(verbose) {
      console.debug('Found favicon from <link>', response.responseURLString,
        iconURLObject.href);
    }
    if(conn) {
      await putEntries(conn, iconURLObject.href, urls);
    }
    return iconURLObject.href;
  }
}

async function findOriginInCache(conn, originURLString, urls, maxAgeMillis) {
  const originURLObject = new URL(originURLString);
  const originEntry = await findEntry(conn, originURLObject);
  const currentDate = new Date();
  if(!originEntry) {
    return;
  }
  if(isEntryExpired(originEntry, currentDate, maxAgeMillis)) {
    return;
  }
  if(verbose) {
    console.debug('Found non-expired origin entry in cache', originURLString,
      originEntry.iconURLString);
  }
  // origin is not in urls, we know it is distinct from them
  await putEntries(conn, originEntry.iconURLString, urls);
  return originEntry.iconURLString;
}

async function lookupOrigin(conn, urlObject, urls, fetchImageTimeoutMillis,
  minImageByteSize, maxImageByteSize, verbose) {

  const rootImageURLString = urlObject.origin + '/favicon.ico';
  const fetchPromise = sendImageHeadRequest(rootImageURLString,
    fetchImageTimeoutMillis, verbose);
  let response;
  try {
    response = await fetchPromise;
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
    return;
  }

  if(response.size === -1 || (response.size >= minImageByteSize &&
      response.size <= maxImageByteSize)) {
    if(conn) {
      await putEntries(conn, response.responseURLString, urls);
    }
    if(verbose) {
      console.debug('Found origin icon', urlObject.href,
        response.responseURLString);
    }
    return response.responseURLString;
  }
}

async function fetchDocumentSilently(urlObject, fetchHTMLTimeoutMillis,
  verbose) {
  try {
    return await fetchDocument(urlObject.href, fetchHTMLTimeoutMillis);
  } catch(error) {
    if(verbose) {
      console.warn(error, urlObject.href);
    }
  }
}

async function setupFaviconDb(name, version, verbose) {
  // TODO: timeoutMillis should be param
  let conn, timeoutMillis;
  try {
    conn = await openFaviconDb(name, version, timeoutMillis, verbose);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

// @param name {String} optional, indexedDB database name
// @param version {Number} optional, indexedDB database version
// @param timeoutMillis {Number} optional, maximum amount of time to wait when
// connecting to indexedDB before failure
// @param verbose {Boolean} optional, whether to log messages to console
// @throws {TypeError} invalid timeout (any other errors occur within promise)
// @returns {Promise} resolves to open IDBDatabase instance
async function openFaviconDb(name, version, timeoutMillis, verbose) {
  if(typeof name === 'undefined') {
    name = 'favicon-cache';
  }
  if(typeof version === 'undefined') {
    version = 2;
  }

  // Override the generic default with a longer time
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 50;
  }

  // In the case of a connection blocked event, eventually timeout
  const connectPromise = openFaviconDbInternal(name, version, verbose);
  const errorMessage = 'Connecting to indexedDB database ' + name +
    ' timed out.';
  const timeoutPromise = rejectAfterTimeout(timeoutMillis, errorMessage);
  const promises = [connectPromise, timeoutPromise];
  return await Promise.race(promises);
}

function openFaviconDbInternal(name, version, verbose) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = onUpgradeNeeded.bind(request, verbose);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
}

function onUpgradeNeeded(verbose, event) {
  const conn = event.target.result;
  if(verbose) {
    console.log('Creating or upgrading database', conn.name);
  }

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    if(verbose) {
      console.log('Creating favicon-cache object store');
    }
    store = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    if(verbose) {
      console.log('Creating dateUpdated index');
    }
    store.createIndex('dateUpdated', 'dateUpdated');
  }
}

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
// @param entry {Object}
// @param currentDate {Date}
// @param maxAgeMillis {Number}
// @returns {Boolean} true if entry is expired
function isEntryExpired(entry, currentDate, maxAgeMillis) {
  // Subtracting a date from another date yields a difference in ms
  const ageMillis = currentDate - entry.dateUpdated;
  return ageMillis > maxAgeMillis;
}

// @param conn {IDBDatabase}
// @returns {Promise}
function clearFaviconDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function findUnexpiredEntry(conn, urlObject, maxAgeMillis) {
  throw new Error('Unimplemented');
}

// Returns a promise that resolves to the first matching entry in the object
// store. An entry matches if its pageURLString property matches the input url.
// @param conn {IDBDatabase}
// @param urlObject {URL}
// @returns {Promise}
function findEntry(conn, urlObject) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlObject.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Returns a promise that resolves to an array of entry objects, where each
// entry is expired
// @param conn {IDBDatabase}
// @param maxAgeMillis {Number}
// @returns {Promise}
function findExpiredEntries(conn, maxAgeMillis) {
  return new Promise((resolve, reject) => {
    let cutoffTime = Date.now() - maxAgeMillis;
    cutoffTime = cutoffTime < 0 ? 0 : cutoffTime;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const range = IDBKeyRange.upperBound(new Date(cutoffTime));
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });
}

// @param conn {IDBDatabase}
// @param pageURLStrings {Iterable}
// @returns {Promise}
function removeEntriesWithURLs(conn, pageURLStrings) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(let url of pageURLStrings) {
      store.delete(url);
    }
  });
}

// TODO: does indexedDB provide a putAll function?
// @param conn {IDBDatabase}
// @param iconURLString {String}
// @param pageURLStrings {Iterable}
// @returns {Promise}
function putEntries(conn, iconURLString, pageURLStrings) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    const currentDate = new Date();
    for(let urlString of pageURLStrings) {
      const entry = {};
      entry.pageURLString = urlString;
      entry.iconURLString = iconURLString;
      entry.dateUpdated = currentDate;
      store.put(entry);
    }
  });
}

// Finds all expired entries in the database and removes them
// @param name {String} optional, indexedDB database name
// @param version {Number} optional, indexedDB database version
// @param maxAgeMillis {Number} optional, amount of time allowed to elapse
// before an entry is considered expired
// @param verbose {Boolean} optional, whether to log messages to console
// @throws {Error} when any error occurs
// @returns {Promise} resolves to number of entries removed
async function compactFaviconDb(name, version, maxAgeMillis, verbose) {
  if(typeof maxAgeMillis === 'undefined') {
    maxAgeMillis = defaultMaxAgeMillis;
  }

  let connectTimeoutMillis, conn;
  try {
    conn = await openFaviconDb(name, version, connectTimeoutMillis, verbose);
    const expiredEntries = await findExpiredEntries(conn, maxAgeMillis);
    const urlStrings = [];
    for(let entry of expiredEntries) {
      urlStrings.push(entry.pageURLString);
    }
    const resolutions = await removeEntriesWithURLs(conn, urlStrings);
    return resolutions.length;
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

function rejectAfterTimeout(timeoutMillis, errorMessage) {
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 4;
  }

  // Per MDN and Google, the minimum is 4ms.
  // Throw immediately as this is a static type error.
  if(timeoutMillis < 4) {
    throw new TypeError('timeoutMillis must be greater than 4: ' +
      timeoutMillis);
  }

  return new Promise((resolve, reject) => {
    const error = new Error(errorMessage);
    setTimeout(reject, timeoutMillis, error);
  });
}

// Race a timeout against a fetch. fetch does not support timeout (yet?).
// A timeout will not cancel/abort the fetch, but will ignore it.
// A timeout rejection results in this throwing an uncaught error
// Timeout is optional
// TODO: eventually use the cancelation token method or whatever it is to
// actually abort the request/response in the case of a timeout
async function fetchWithTimeout(urlString, options, timeoutMillis) {
  if(typeof urlString !== 'string') {
    throw new TypeError('Parameter urlString is not a defined string: ' +
      urlString);
  }

  if('onLine' in navigator && !navigator.onLine) {
    throw new Error('Cannot fetch url while offline ' + urlString);
  }

  const fetchPromise = fetch(urlString, options);
  let response;
  if(timeoutMillis) {
    const errorMessage = 'Request timed out for url ' + urlString;
    const timeoutPromise = rejectAfterTimeout(timeoutMillis, errorMessage);
    const promises = [fetchPromise, timeoutPromise];
    response = await Promise.race(promises);
  } else {
    response = await fetchPromise;
  }

  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }
  return response;
}

async function fetchDocument(urlString, timeoutMillis) {
  const headers = {'Accept': 'text/html'};
  const fetchOptions = {};
  fetchOptions.credentials = 'omit';
  fetchOptions.method = 'get';
  fetchOptions.headers = headers;
  fetchOptions.mode = 'cors';
  fetchOptions.cache = 'default';
  fetchOptions.redirect = 'follow';
  fetchOptions.referrer = 'no-referrer';
  fetchOptions.referrerPolicy = 'no-referrer';
  const response = await fetchWithTimeout(urlString, fetchOptions,
    timeoutMillis);
  assertResponseHasContent(response, urlString);
  assertResponseHasHTMLType(response, urlString);
  const outputResponse = {};
  outputResponse.text = async function() {
    return await response.text();
  };
  outputResponse.responseURLString = response.url;
  outputResponse.redirected = detectRedirect(urlString, response.url);
  return outputResponse;
}

function detectRedirect(requestURLString, responseURLString) {
  // A redirected url is never the same as the request url. Regardless of
  // what happens in the underlying opaque request.
  if(requestURLString === responseURLString) {
    return false;
  }
  const requestURLObject = new URL(requestURLString);
  const responseURLObject = new URL(responseURLString);
  requestURLObject.hash = '';
  responseURLObject.hash = '';
  return requestURLObject.href !== responseURLObject.href;
}

function parseHTML(htmlString) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlString, 'text/html');
  const errors = doc.getElementsByTagName('parsererror');
  if(errors && errors.length) {
    throw new Error('Embedded html parser error: ' + errors[0].textContent);
  }

  const rootName = doc.documentElement.localName.toLowerCase();
  if(rootName !== 'html') {
    throw new Error(`Document element is not <html>: ${rootName}`);
  }

  return doc;
}

// Sends a HEAD request for the given image.
// @param urlString {String}
// @returns a simple object with props imageSize and responseURLString
async function sendImageHeadRequest(urlString, timeoutMillis, verbose) {
  const headers = {'Accept': 'image/*'};
  const fetchOptions = {};
  fetchOptions.credentials = 'omit';
  fetchOptions.method = 'HEAD';
  fetchOptions.headers = headers;
  fetchOptions.mode = 'cors';
  fetchOptions.cache = 'default';
  fetchOptions.redirect = 'follow';
  fetchOptions.referrer = 'no-referrer';
  const response = await fetchWithTimeout(urlString, fetchOptions,
    timeoutMillis);
  assertResponseHasImageType(response);
  const outputResponse = {};
  outputResponse.size = getResponseContentLength(response, verbose);
  outputResponse.responseURLString = response.url;
  return outputResponse;
}

function getResponseContentLength(response, verbose) {
  const contentLengthString = response.headers.get('Content-Length');
  if(contentLengthString) {
    const radix = 10;
    try {
      return parseInt(contentLengthString, radix);
    } catch(error) {
      // Invalid content length is considered routine in the sense of dealing
      // with unsanitized remote input, so reporting this error is conditional
      // on the verbose flag.
      if(verbose) {
        console.warn(error);
      }
    }
  }
  return -1;
}

// Response.ok is true for 204, but I treat 204 as error.
function assertResponseHasContent(response, urlString) {
  const httpStatusNoContent = 204;
  if(response.status === httpStatusNoContent) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }
}

function assertResponseHasHTMLType(response, urlString) {
  const typeHeader = response.headers.get('Content-Type');
  if(!/^\s*text\/html/i.test(typeHeader)) {
    throw new Error(`Invalid content type "${typeHeader}" ${urlString}`);
  }
}

function assertResponseHasImageType(response) {
  const typeHeader = response.headers.get('Content-Type');
  if(!/^\s*image\//i.test(typeHeader)) {
    throw new Error(`Invalid response type ${typeHeader}`);
  }
}

// Export methods to outer (global) scope
this.lookupFavicon = lookupFavicon;
this.openFaviconDb = openFaviconDb;
this.clearFaviconDb = clearFaviconDb;
this.compactFaviconDb = compactFaviconDb;
this.setupFaviconDb = setupFaviconDb;

} // End file block scope
