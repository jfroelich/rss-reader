// See license.md

'use strict';

const favicon = {};

// 30 days in ms
favicon.defaultMaxAgeMillis = 1000 * 60 * 60 * 24 * 30;

// @param conn {IDBDatabase} an open indexedDB connection
// @param urlObject {URL} the url to lookup
// @returns {String} the icon url or null/undefined
favicon.lookup = async function(conn, urlObject, options) {

  options = options || {};
  const verbose = 'verbose' in options ? options.verbose : false;
  const maxAgeMillis = 'maxAgeMillis' in options ? options.maxAgeMillis :
    favicon.defaultMaxAgeMillis;
  if(verbose) {
    console.log('LOOKUP', urlObject.href);
  }

  // Lookup the url in the cache
  const currentDate = new Date();
  const entry = await favicon.findEntry(conn, urlObject.href);
  if(entry && !favicon.isEntryExpired(entry, currentDate, maxAgeMillis)) {
    return entry.iconURLString;
  }

  const uniqueURLStrings = [urlObject.href];

  // If we did not find a cached entry, or if we found a cached entry but it
  // is expired, then plan on fetching. Before fetching, check if we are
  // offline so as to distinguish offline from other fetch errors.
  if('onLine' in navigator && !navigator.onLine) {
    return;
  }

  // Fetch errors are non-fatal.
  // TODO: maybe make into a helper, fetchSilently
  let responseURLObject;
  let response;
  try {
    response = await favicon.fetchDocument(urlObject.href, options);
    responseURLObject = new URL(response.responseURLString);
  } catch(error) {
    if(verbose) {
      console.warn(error, urlObject.href);
    }
  }

  // If the fetch failed and we have an expired entry, remove it and continue
  if(entry && !response) {
    await favicon.removeEntry(conn, urlObject.href);
  }

  if(response && response.redirected) {
    uniqueURLStrings.push(responseURLObject.href);
  }

  // TODO: before parsing the page, we should be checking for a redirect
  // entry as well. This way we can skip all the parsing and searching.
  // Technically just the searching (for now). This assumes the db lookup
  // is faster than the page searching.
  const baseURLObject = response && response.redirected ? responseURLObject :
    urlObject;

  let docIconURL;
  if(response) {
    docIconURL = favicon.findIconInDocument(response.doc, baseURLObject);

    // If we found an in page icon, update the cache and resolve
    // TODO: can also store origin in cache if it distinct? would need to move
    // some origin url code upward
    if(docIconURL) {
      if(verbose) {
        console.debug('Found favicon <link>', uniqueURLStrings,
          docIconURL.href);
      }
      await favicon.putEntries(conn, docIconURL.href, uniqueURLStrings);
      return docIconURL.href;
    }
  }

  // If we did not find an in page icon, and we redirected, check cache for
  // redirect
  let redirectEntry;
  if(response && response.redirected) {
    redirectEntry = await favicon.findEntry(conn, responseURLObject.href);
    if(redirectEntry && !favicon.isEntryExpired(redirectEntry, currentDate,
      maxAgeMillis)) {
      // If there was an entry but we did not resolve to it earlier it must
      // be expired. But the redirect is not. Update the original so that
      // future lookups are faster.
      if(entry) {
        await favicon.putEntries(conn, redirectEntry.iconURLString,
          [urlObject.href]);
      }

      return redirectEntry.iconURLString;
    }
  }

  // If the origin is different from the request url and the redirect url,
  // then check the cache for the origin
  let originEntry;
  if(!uniqueURLStrings.includes(urlObject.origin)) {
    uniqueURLStrings.push(urlObject.origin);
    originEntry = await favicon.findEntry(conn, urlObject.origin);
  }

  // If an origin entry exists and is not expired, then update entries for the
  // other urls and resolve
  if(originEntry && !favicon.isEntryExpired(originEntry, currentDate, maxAgeMillis)) {
    const iconURLString = originEntry.iconURLString;
    const tx = conn.transaction('favicon-cache', 'readwrite');
    if(response && response.redirected) {
      const urls = [urlObject.href, responseURLObject.href];
      await favicon.putEntries(conn, iconURLString, urls);
    } else {
      await favicon.putEntry(tx, urlObject.href, iconURLString);
    }
    return iconURLString;
  }

  // Fall back to checking domain root
  // TODO: this should be a call to a helper
  const rootImageURL = urlObject.origin + '/favicon.ico';
  let imageSize = -1, imageResponseURLString;
  try {
    const response = await favicon.fetchImageHead(rootImageURL, options);
    imageSize = response.imageSize;
    imageResponseURLString = response.imageResponseURLString;
  } catch(error) {
    if(verbose) {
      console.warn(error);
    }
  }

  const minSize = 'minSize' in options ? options.minSize : 49;
  const maxSize = 'maxSize' in options ? options.maxSize : 10 * 1024 + 1;

  if(imageResponseURLString && (imageSize === -1 ||
    (imageSize > minSize && imageSize < maxSize))) {
    await favicon.putEntries(conn, imageResponseURLString, uniqueURLStrings);
    return imageResponseURLString;
  }

  // Remove entries we know that exist but are expired
  const expiredURLs = [];
  if(entry) {
    expiredURLs.push(entry.pageURLString);
  }

  if(redirectEntry) {
    expiredURLs.push(redirectEntry.pageURLString);
  }

  if(originEntry) {
    expiredURLs.push(originEntry.pageURLString);
  }

  await favicon.removeEntriesWithURLs(conn, expiredURLs);
};

favicon.install = async function(options) {
  let conn;
  try {
    conn = await favicon.connect(options);
  } finally {
    if(conn) {
      conn.close();
    }
  }
};

favicon.putEntries = async function(conn, iconURLString, pageURLStrings) {
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const promises = [];
  for(let urlString of pageURLStrings) {
    const promise = favicon.putEntry(tx, urlString, iconURLString);
    promises.push(promise);
  }
  await Promise.all(promises);
};

favicon.connect = function(options) {
  return new Promise((resolve, reject) => {
    const defaultName = 'favicon-cache';
    const defaultVersion = 2;
    const defaultVerbose = false;
    options = options || {};
    const name = 'name' in options ? options.name : defaultName;
    const version = 'version' in options ? options.version : defaultVersion;
    const verbose = 'verbose' in options ? options.verbose : defaultVerbose;
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon.onUpgradeNeeded.bind(request, verbose);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      if(verbose) {
        console.warn('Connection blocked');
      }
    };
  });
};

favicon.onUpgradeNeeded = function(verbose, event) {
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
};

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
favicon.isEntryExpired = function(entry, currentDate, maxAgeMillis) {
  const ageMillis = currentDate - entry.dateUpdated;
  return ageMillis > maxAgeMillis;
};

favicon.findEntry = function(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

favicon.putEntry = function(tx, pageURLString, iconURLString) {
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
};

favicon.removeEntry = function(conn, pageURL) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(pageURL);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
};

favicon.getEntries = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

favicon.getExpiredEntries = function(conn, maxAgeMillis) {
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
};

// @param urls {Array} an array of page url strings
// @returns {Promise}
favicon.removeEntriesWithURLs = function(conn, urls) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(let url of urls) {
      store.delete(url);
    }
  });
};

// Finds all expired entries in the database and removes them
favicon.compact = async function(options) {
  options = options || {};
  const maxAgeMillis = 'maxAgeMillis' in options ? options.maxAgeMillis :
    favicon.defaultMaxAgeMillis;
  let conn;
  try {
    conn = await favicon.connect(options);
    const expiredEntries = await favicon.getExpiredEntries(conn, maxAgeMillis);
    const urlStrings = [];
    for(let entry of expiredEntries) {
      urlStrings.push(entry.pageURLString);
    }
    const resolutions = await favicon.removeEntriesWithURLs(conn, urlStrings);
    return resolutions.length;
  } finally {
    if(conn) {
      conn.close();
    }
  }
};

// Search for icon links in the document, and ensure the links are absolute.
// Use the first valid link found.
favicon.findIconInDocument = function(document, baseURLObject) {
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
    iconURLString = favicon.matchSelector(document.head, selectorString,
      baseURLObject);
    if(iconURLString) {
      return iconURLString;
    }
  }
};

// Looks for a <link> tag within the ancestor element, and if found, get its
// url value as a URL object. Simultaneously, when checking if the url is valid,
// resolve it. Return the resolved absolute url.
// @param ancestorElement {Element} the element within which to confine the
// search.
// @param selectorString {String} the CSS selector condition
// @param baseURLObject {URL} absolute form of the href values
favicon.matchSelector = function(ancestorElement, selectorString,
  baseURLObject) {

  const element = ancestorElement.querySelector(selectorString);
  if(!element) {
    return;
  }

  let hrefString = element.getAttribute('href');

  // If the element did not have the attribute, return. Cannot rely on catching
  // the error later when parsing the url
  if(!hrefString) {
    return;
  }

  // Trimming may be necessary because I am not clear on the behavior of
  // url parsing of whitespace only strings. So in order to avoid any
  // ambiguity do it explicitly.
  hrefString = hrefString.trim();

  // If the element is empty after trimming, return. Cannot rely on catching
  // the error later when parsing the url
  if(!hrefString) {
    return;
  }

  // Deserialize the url
  let urlObject;
  try {
    urlObject = new URL(hrefString, baseURLObject);
  } catch(error) {
    //console.warn(error);
  }

  return urlObject;
};

// Rejects after a timeout (ms)
favicon.fetchWithTimeout = function(url, timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(reject, timeout, new Error(`Request timed out ${url}`));
  });
};

// Race a timeout against a fetch. fetch does not support timeout (yet?).
// A timeout will not cancel/abort the fetch, but will ignore it.
// A timeout rejection results in this throwing an uncaught error
// Timeout is optional
favicon.fetch = async function(urlString, options, timeoutMillis) {
  let response;
  if(timeoutMillis) {
    const promises = [
      fetch(urlString, options),
      favicon.fetchWithTimeout(urlString, timeoutMillis)
    ];
    response = await Promise.race(promises);
  } else {
    response = await fetch(urlString, options);
  }

  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }

  return response;
};

favicon.assertValidHTMLMimeType = function(response, urlString) {
  const typeHeader = response.headers.get('Content-Type');
  if(!/^\s*text\/html/i.test(typeHeader)) {
    throw new Error(`Invalid content type "${typeHeader}" ${urlString}`);
  }
};

// Fetches the html Document for the given url
// @param url {String}
favicon.fetchDocument = async function(urlString, options) {
  const timeoutMillis = 'fetchHTMLTimeoutMillis' in options ?
    options.fetchHTMLTimeoutMillis : 1000;
  const headers = {'Accept': 'text/html'};
  const fetchOptions = {};
  fetchOptions.credentials = 'omit';
  fetchOptions.method = 'get';
  fetchOptions.headers = headers;
  fetchOptions.mode = 'cors';
  fetchOptions.cache = 'default';
  fetchOptions.redirect = 'follow';
  fetchOptions.referrer = 'no-referrer';

  const response = await favicon.fetch(urlString, fetchOptions, timeoutMillis);
  const httpStatusNoContent = 204;
  if(response.status === httpStatusNoContent) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }

  favicon.assertValidHTMLMimeType(response, urlString);

  // TODO: defer text parsing till later in calling context
  const text = await response.text();
  const doc = favicon.parseHTML(text);

  // TODO: name properties better
  const outputResponse = {};
  outputResponse.doc = doc;
  outputResponse.responseURLString = response.url;
  outputResponse.redirected = favicon.detectRedirect(urlString, response.url);
  return outputResponse;
};

favicon.detectRedirect = function(requestURLString, responseURLString) {
  if(requestURLString === responseURLString) {
    return false;
  }
  const requestURLObject = new URL(requestURLString);
  const responseURLObject = new URL(responseURLString);
  requestURLObject.hash = '';
  responseURLObject.hash = '';
  return requestURLObject.href !== responseURLObject.href;
};

favicon.parseHTML = function(htmlString) {
  const parser = new DOMParser();
  const document = parser.parseFromString(text, 'text/html');

  const rootName = document.documentElement.localName.toLowerCase();
  if(rootName !== 'html') {
    throw new Error(`Invalid document element ${rootName}`);
  }

  const parserErrorElement = document.getElementsByTagName('parsererror');
  if(parserErrorElement) {
    throw new Error(parserErrorElement.textContent);
  }

  return document;
};

// Sends a HEAD request for the given image.
// @param urlString {String}
// @returns a simple object with props imageSize and imageResponseURLString
favicon.fetchImageHead = async function(urlString, options) {

  const timeoutMillis = 'fetchImageTimeoutMillis' in options ?
    options.fetchImageTimeoutMillis : 100;

  const headers = {'accept': 'image/*'};
  const fetchOptions = {};
  fetchOptions.credentials = 'omit';
  fetchOptions.method = 'HEAD';
  fetchOptions.headers = headers;
  fetchOptions.mode = 'cors';
  fetchOptions.cache = 'default';
  fetchOptions.redirect = 'follow';
  fetchOptions.referrer = 'no-referrer';

  const response = await favicon.fetch(urlString, fetchOptions, timeoutMillis);
  favicon.assertValidImageMimeType(response);

  // TODO: this should be a helper
  const lenHeader = response.headers.get('Content-Length');
  let lenInt = -1;
  if(lenHeader) {
    try {
      lenInt = parseInt(lenHeader, 10);
    } catch(error) {
    }
  }

  // TODO: rename to size and responseURLString`
  return {'imageSize:': lenInt, 'imageResponseURLString': response.url};
};

favicon.assertValidImageMimeType = function(response) {
  const typeHeader = response.headers.get('Content-Type');
  if(!/^\s*image\//i.test(typeHeader)) {
    throw new Error(`Invalid response type ${typeHeader}`);
  }
};
