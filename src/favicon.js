// See license.md

'use strict';

{ // Begin file block scope

// 30 days in ms, used by both lookup and compact
const defaultMaxAgeMillis = 1000 * 60 * 60 * 24 * 30;

// @param conn {IDBDatabase} an open indexedDB connection, if left undefined
// then database not used (cacheless lookup)
// @param urlObject {URL} the url of a webpage to lookup and find the icon
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

  if(verbose) {
    console.log('LOOKUP', urlObject.href);
  }

  const currentDate = new Date();
  // Contains distinct urls checked
  const urlSet = new Set();

  // Lookup the url in the cache
  let entry;
  if(conn) {
    entry = await findEntry(conn, urlObject);
    if(entry && !isEntryExpired(entry, currentDate, maxAgeMillis)) {
      if(verbose) {
        console.log('Found favicon of input url in cache', entry);
      }
      return entry.iconURLString;
    }
  }

  // Before fetching, verify we can fetch so as to distinguish between
  // network errors and other fetch errors, and to potentially avoid work
  if('onLine' in navigator && !navigator.onLine) {
    if(verbose) {
      console.warn('Canceled favicon lookup of url %s because offline',
        urlObject.href);
    }
    return;
  }

  // Add the input url to the distinct urls set
  urlSet.add(urlObject.href);

  const response = await fetchDocumentSilently(urlObject,
    fetchHTMLTimeoutMillis, verbose);

  // TODO: maybe this is best deferred until compact? But now we know the
  // entry is invalid, and this info is not available to compact, because
  // compact doesn't guarantee the remote url is reachable. Unsure.
  if(conn && !response && entry) {
    if(verbose) {
      console.debug(
        'Removing expired input entry from cache because of failed request',
        urlObject.href);
    }

    await removeEntry(conn, urlObject.href);
  }

  let responseURLObject;
  if(response) {
    responseURLObject = new URL(response.responseURLString);
  }

  // If we redirected, check cache for redirect
  let redirectEntry;
  if(response && response.redirected) {
    urlSet.add(responseURLObject.href);

    if(conn) {
      redirectEntry = await findEntry(conn, responseURLObject);
    }

    if(redirectEntry && !isEntryExpired(redirectEntry, currentDate,
      maxAgeMillis)) {
      if(verbose) {
        console.debug('Found non-expired redirect in cache', redirectEntry);
      }

      // If there was an entry but we did not resolve to it earlier it must
      // be expired. But the redirect is not. Update the original so that
      // future lookups are faster.
      if(conn && entry) {
        await putEntries(conn, redirectEntry.iconURLString, [urlObject.href]);
      }

      return redirectEntry.iconURLString;
    }
  }

  // At this point we requested the document. Neither the original url or the
  // redirected url exist in the cache, or they do exist but are expired.
  // Check the response
  if(response) {
    const responseDoc = await parseHTMLResponse(response, verbose);
    if(responseDoc) {
      let iconURLObject;
      const baseURLObject = response.redirected ? responseURLObject :
        urlObject;
      iconURLObject = findIconInDocument(responseDoc, baseURLObject);

      // If we found an in page icon, update the cache and resolve
      // Do not also modify origin. Origin may have its own favicon.
      if(iconURLObject) {
        if(verbose) {
          console.debug('Found favicon from <link>', Array.from(urlSet),
            iconURLObject.href);
        }

        if(conn) {
          // TODO: do I need to convert to array or can putEntries accept a
          // set?
          await putEntries(conn, iconURLObject.href, Array.from(urlSet));
        }

        return iconURLObject.href;
      }
    }
  }

  // Check the cache for the origin
  let originEntry;
  if(!urlSet.has(urlObject.origin)) {
    urlSet.add(urlObject.origin);
    const originURLObject = new URL(urlObject.origin);

    if(conn) {
      originEntry = await findEntry(conn, originURLObject);
    }

    // If an origin entry exists and is not expired, then update entries for the
    // other urls and resolve
    if(originEntry && !isEntryExpired(originEntry, currentDate,
      maxAgeMillis)) {
      const iconURLString = originEntry.iconURLString;

      if(conn) {
        // TODO: use a set?
        const pageURLStrings = [];
        if(response && response.redirected) {
          pageURLStrings.push(urlObject.href);
          pageURLStrings.push(responseURLObject.href);
        } else {
          pageURLStrings.push(iconURLString);
        }

        await putEntries(conn, urlObject.href, pageURLStrings);
      }

      if(verbose) {
        console.debug('Found non-expired origin entry in cache', urlObject.href,
          originEntry);
      }
      return iconURLString;
    }
  }

  // Input url, redirect url, and origin all failed. Check domain root.
  const imageResponse = await fetchRootIconSilently(urlObject,
    fetchImageTimeoutMillis, verbose);

  // TODO: this condition got kind of big, use a helper function?
  if(imageResponse && imageResponse.responseURLString &&
    (imageResponse.size === -1 ||
    (imageResponse.size >= minImageByteSize &&
      imageResponse.size <= maxImageByteSize))) {

    // Create or update entries for input, redirect, origin
    if(conn) {
      await putEntries(conn, imageResponse.responseURLString,
        Array.from(urlSet));
    }

    if(verbose) {
      console.debug('Found domain root favicon', urlObject.href,
        imageResponse.responseURLString);
    }

    return imageResponse.responseURLString;
  }

  if(conn) {
    // TODO: why not use urlSet instead of the individual entries here???
    // Also, doing that would maybe allow me to write the above sections as
    // helpers and not keep these variables around in function scope
    await cleanupDbOnFailedLookup(conn, entry, redirectEntry, originEntry,
      verbose);
  }
}

async function cleanupDbOnFailedLookup(conn, entry, redirectEntry,
  originEntry, verbose) {
  // TODO: use a set
  const urlStrings = [];
  if(entry) {
    urlStrings.push(entry.pageURLString);
  }
  if(redirectEntry) {
    urlStrings.push(redirectEntry.pageURLString);
  }
  if(originEntry) {
    urlStrings.push(originEntry.pageURLString);
  }

  if(verbose && urlStrings.length) {
    console.log('Cleaning up cache on failed lookup, removing urls',
      urlStrings);
  }

  await removeEntriesWithURLs(conn, urlStrings);
}

async function fetchDocumentSilently(urlObject, fetchHTMLTimeoutMillis,
  verbose) {

  try {
    return await fetchDocument(urlObject.href, fetchHTMLTimeoutMillis);
  } catch(error) {
    // This type of error is routine, so reporting it should be conditioned
    // on verbose. Not all fetches are expected to work.
    if(verbose) {
      console.warn(error, urlObject.href);
    }
  }
}

async function fetchRootIconSilently(urlObject, timeoutMillis, verbose) {
  const rootImageURL = urlObject.origin + '/favicon.ico';
  try {
    return await sendImageHeadRequest(rootImageURL, timeoutMillis, verbose);
  } catch(error) {
    // Routine error, because the image may not exist, so only print the error
    // if verbose
    if(verbose) {
      console.warn(error);
    }
  }
}

async function parseHTMLResponse(response, verbose) {
  let doc;
  try {
    const text = await response.text();
    return parseHTML(text);
  } catch(error) {
    // Parsing errors are routine given the dirtiness of data, so only
    // print the error if verbose
    if(verbose) {
      console.warn(error);
    }
  }
}

async function setupFaviconDb(name, version, verbose) {
  let conn;
  try {
    conn = await openFaviconDb(name, version, verbose);
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

async function putEntries(conn, iconURLString, pageURLStrings) {
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const promises = [];
  for(let urlString of pageURLStrings) {
    const promise = putEntry(tx, urlString, iconURLString);
    promises.push(promise);
  }
  await Promise.all(promises);
}

function openFaviconDb(name, version, verbose) {
  return new Promise((resolve, reject) => {
    if(typeof name === 'undefined') {
      name = 'favicon-cache';
    }
    if(typeof version === 'undefined') {
      version = 2;
    }

    const request = indexedDB.open(name, version);
    request.onupgradeneeded = onUpgradeNeeded.bind(request, verbose);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);

    // Reporting an error in the console when the connection is blocked is
    // not tied to the verbose parameter.
    request.onblocked = console.warn;
  });
}

function onUpgradeNeeded(verbose, event) {
  const conn = event.target.result;
  if(verbose) {
    console.log('Creating or upgrading favicon database', conn.name);
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
function isEntryExpired(entry, currentDate, maxAgeMillis) {
  const ageMillis = currentDate - entry.dateUpdated;
  return ageMillis > maxAgeMillis;
}

function clearFaviconDb(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function findEntry(conn, urlObject) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlObject.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: revert to accepting conn, create tx locally.
function putEntry(tx, pageURLString, iconURLString) {
  return new Promise((resolve, reject) => {
    const entry = {
      'pageURLString': pageURLString,
      'iconURLString': iconURLString,
      'dateUpdated': new Date()
    };
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function removeEntry(conn, pageURL) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(pageURL);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

/*
// TODO: is this in use? cannot find where this is called
// TODO: delete after further testing
function getEntries(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
*/

function getExpiredEntries(conn, maxAgeMillis) {
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

// @param urls {Array} an array of page url strings
// @returns {Promise}
function removeEntriesWithURLs(conn, urls) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(let url of urls) {
      store.delete(url);
    }
  });
}

// Finds all expired entries in the database and removes them
async function compactFaviconDb(name, version, maxAgeMillis, verbose) {

  if(typeof maxAgeMillis === 'undefined') {
    maxAgeMillis = defaultMaxAgeMillis;
  }

  let conn;
  try {
    conn = await openFaviconDb(name, version, verbose);
    const expiredEntries = await getExpiredEntries(conn, maxAgeMillis);
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

// Search for icon links in the document, and ensure the links are absolute.
// Use the first valid link found.
function findIconInDocument(document, baseURLObject) {
  if(!document || !document.head) {
    throw new TypeError('Invalid document (undefined or no head)');
  }

  const selectorStringArray = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];
  let iconURLString;
  for(let selectorString of selectorStringArray) {
    iconURLString = matchSelector(document.head, selectorString,
      baseURLObject);
    if(iconURLString) {
      return iconURLString;
    }
  }
}

// Looks for a <link> tag within the ancestor element, and if found, get its
// url value as a URL object. Simultaneously, when checking if the url is valid,
// resolve it. Return the resolved absolute url.
// @param ancestorElement {Element} the element within which to confine the
// search.
// @param selectorString {String} the CSS selector condition
// @param baseURLObject {URL} absolute form of the href values
function matchSelector(ancestorElement, selectorString, baseURLObject) {
  const element = ancestorElement.querySelector(selectorString);
  if(!element) {
    return;
  }

  // Avoid passing an empty string to the URL constructor
  let hrefString = element.getAttribute('href');
  if(!hrefString) {
    return;
  }
  hrefString = hrefString.trim();
  if(!hrefString) {
    return;
  }

  try {
    return new URL(hrefString, baseURLObject);
  } catch(error) {
  }
}

function rejectRequestAfterTimeout(url, timeoutMillis) {
  return new Promise((resolve, reject) => {
    setTimeout(reject, timeoutMillis, new Error(`Request timed out ${url}`));
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

  const fetchPromise = fetch(urlString, options);
  let response;
  if(timeoutMillis) {
    const timeoutPromise = rejectRequestAfterTimeout(urlString, timeoutMillis);
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
// @returns a simple object with props imageSize and imageResponseURLString
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
