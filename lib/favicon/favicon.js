// See license.md

'use strict';

// TODO: add an install hook so that the db can be setup at install time

const favicon = {};
favicon.dbName = 'favicon-cache';
favicon.dbVersion = 2;

// The time that elapses before entry is considered
// expired, that is by default 30 days (in ms)
favicon.maxAgeMillis = 1000 * 60 * 60 * 24 * 30;

// Byte size ends points for images. Images outside these bounds are
// considered invalid icons.
favicon.minSize = 49;
favicon.maxSize = 10 * 1024 + 1;

// Default timeouts for fetching (in ms)
favicon.fetchHTMLTimeoutMillis = 1000;
favicon.fetchImageTimeoutMillis = 100;

// TODO: this function is simply too large and needs to be broken up into
// helper functions
// TODO: logging should be optional, maybe have a console parameter where log
// only occurs if parameter defined
// TODO: add an options object that is passed around instead of accessing
// globals
// Given a url, lookup the associated favicon url. Tries to follow the spec by
// first checking for the icon in the page, then checking in the domain root.
// Tries to use a cache to speed up queries.
// @param conn {IDBDatabase} an open indexedDB connection
// @param urlObject {URL} the url to lookup
// @returns {String} the icon url or null/undefined
favicon.lookup = async function(conn, urlObject) {
  console.log('LOOKUP', urlObject.href);

  const uniqueURLsArray = [urlObject.href];
  const currentDate = new Date();

  // Lookup the url in the cache
  const entryObject = await favicon.findEntry(urlObject.href);
  if(entryObject && !favicon.isEntryExpired(entryObject, currentDate)) {
    return entryObject.iconURLString;
  }

  // If we did not find a cached entry, or if we found a cached entry but it
  // is expired, then plan on fetching. Before fetching, check if we are
  // offline so as to distinguish offline from other fetch errors.
  if('onLine' in navigator && !navigator.onLine) {
    return;
  }

  // Fetch the html of the url. Fetch errors are non-fatal.
  // TODO: redirected is a boolean, use boolean naming convention like
  // didRedirect
  let doc, responseURL, redirected = false;
  try {
    ({doc, responseURL, redirected} =
      await favicon.fetchDocument(urlObject.href));
    responseURL = new URL(responseURL);
  } catch(error) {
    console.warn(error, urlObject.href);
  }

  // If redirected, add the response url to unique urls
  if(redirected) {
    uniqueURLsArray.push(responseURL.href);
  }

  // If the fetch failed but we have an expired entry, remove it
  if(entryObject && !doc) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    await favicon.removeEntry(tx, urlObject.href);
  }

  const baseURLObject = redirected ? responseURL : urlObject;
  const docIconURL = favicon.findIconInDocument(doc, baseURLObject);

  // If we found an in page icon, update the cache and resolve
  // TODO: can also store origin in cache if it distinct? would need to move
  // some origin url code upward
  if(docIconURL) {
    console.debug('Found favicon <link>', urlObject.href, docIconURL.href);

    // TODO: these 3 statements should be a call to putAll
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const proms = uniqueURLsArray.map((urlObject) =>
      favicon.putEntry(tx, urlObject, docIconURL.href));
    await Promise.all(proms);
    return docIconURL.href;
  }

  // If we did not find an in page icon, and we redirected, check cache for
  // redirect
  let redirectEntry;
  if(redirected) {
    redirectEntry = await favicon.findEntry(responseURL.href);
  }

  // If the redirect exists and is not expired, then resolve
  // TODO: this condition should only be tested if redirected
  if(redirectEntry && !favicon.isEntryExpired(redirectEntry, currentDate)) {
    return redirectEntry.iconURLString;
  }

  // If the origin is different from the request url and the redirect url,
  // then check the cache for the origin
  let originEntry;
  if(!uniqueURLsArray.includes(urlObject.origin)) {
    uniqueURLsArray.push(urlObject.origin);
    originEntry = await favicon.findEntry(urlObject.origin);
  }

  // If an origin entry exists and is not expired, then update entries for the
  // other urls and resolve
  if(originEntry && !favicon.isEntryExpired(originEntry, currentDate)) {

    // TODO: rename to iconURLString
    const iconURL = originEntry.iconURLString;
    const tx = conn.transaction('favicon-cache', 'readwrite');
    if(redirected) {
      // TODO: this should be a call to some type of put all function
      const urls = [urlObject.href, responseURL.href];
      const proms = proms.map((urlObject) =>
        favicon.putEntry(tx, urlObject, iconURL));
      await Promise.all(proms);
    } else {
      await favicon.putEntry(tx, urlObject.href, iconURL);
    }

    return iconURL;
  }

  // Fall back to checking domain root
  const rootImageURL = urlObject.origin + '/favicon.ico';
  let imageSize, imageResponseURL;
  try {
    ({imageSize, imageResponseURL} =
      await favicon.fetchImageHead(rootImageURL));
  } catch(error) {
    console.warn(error);
  }

  const sizeInRange = imageSize === -1 ||
    (imageSize > favicon.minSize && imageSize < favicon.maxSize);

  // If fetched and size is in range, then resolve to it
  if(imageResponseURL && sizeInRange) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const proms = uniqueURLsArray.map((urlObject) =>
      favicon.putEntry(tx, urlObject, imageResponseURL));
    await Promise.all(proms);
    return imageResponseURL;
  }

  // Remove entries we know that exist but are expired
  const expiredURLArray = [];
  if(entryObject) {
    expiredURLArray.push(entryObject.pageURLString);
  }

  if(redirectEntry) {
    expiredURLArray.push(redirectEntry.pageURLString);
  }

  if(originEntry) {
    expiredURLArray.push(originEntry.pageURLString);
  }

  await favicon.removeEntriesWithURLs(expiredURLArray);
};

// Returns true if the entry is expired. An entry is expired if the difference
// between today's date and the date the entry was last updated is greater than
// max age.
favicon.isEntryExpired = function(entryObject, currentDate) {
  const ageMillis = currentDate - entryObject.dateUpdated;
  return ageMillis > favicon.maxAgeMillis;
};

favicon.connect = function(name = favicon.dbName, version = favicon.dbVersion) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon.onUpgradeNeeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => console.warn('Connection blocked');
  });
};

// Upgrades the internal database
favicon.onUpgradeNeeded = function(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;

  let faviconCacheStore;
  if(!event.oldVersion || event.oldVersion < 1) {
    console.debug('Creating favicon-cache object store');
    faviconCacheStore = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    faviconCacheStore = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    faviconCacheStore.createIndex('dateUpdated', 'dateUpdated');
  }
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

// Adds or replaces an entry in the cache
favicon.putEntry = function(tx, pageURLString, iconURLString) {
  return new Promise((resolve, reject) => {
    const entryObject = {
      'pageURLString': pageURLString,
      'iconURLString': iconURLString,
      'dateUpdated': new Date()
    };
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entryObject);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

favicon.removeEntry = function(tx, pageURL) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(pageURL);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
};

// Get all entries in the database as an array
favicon.getEntryArray = function(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// TODO: age should probably be a parameter to this function
favicon.getExpiredEntryArray = function(conn) {
  return new Promise((resolve, reject) => {
    let cutoffTime = Date.now() - favicon.maxAgeMillis;
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

// Returns an array of the results of remove calls
// @param urls an array of urls
favicon.removeEntriesWithURLs = async function(conn, urls) {
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const promises = urls.map((url) => favicon.removeEntry(tx, url));
  return await Promise.all(promises);
};

// Finds all expired entries in the database and removes them
favicon.compact = async function(conn) {
  const expiredEntries = await favicon.getExpiredEntryArray(conn);
  const expiredURLArray = expiredEntries.map((e) => e.pageURLString);
  const resolutions = await favicon.removeEntriesWithURLs(conn, expiredURLArray);
  return resolutions.length;
};


// Search for icon links in the document, and ensure the links are absolute.
// Use the first valid link found.
// TODO: use querySelectorAll?
favicon.findIconInDocument = function(documentObject, baseURLObject) {

  // TODO: not sure if is defined test is appropriate, should consider the
  // document parameter as required?

  if(!documentObject || !documentObject.head) {
    return undefined;
  }

  const selectorStringArray = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];
  let iconURLString;

  for(let selectorString of selectorStringArray) {
    iconURLString = favicon.matchSelector(documentObject.head, selectorString,
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

// Rejects after a timeout
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
  return response;
};

// Fetches the html Document for the given url
// @param url {String}
// TODO: maybe I can avoid parsing and just search raw text for
// <link> tags, the accuracy loss may be ok given the speed boost
// TODO: use streaming text api, stop reading on </head>
favicon.fetchDocument = async function(urlString) {
  const opts = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };

  const response = await favicon.fetch(urlString, opts,
    favicon.fetchHTMLTimeoutMillis);

  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }
  if(response.status === 204) {
    throw new Error(`${response.status} ${response.statusText} ${urlString}`);
  }
  const typeHeader = response.headers.get('Content-Type');
  if(!/^\s*text\/html/i.test(typeHeader)) {
    throw new Error(`Invalid content type "${typeHeader}" ${urlString}`);
  }
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  if(doc.documentElement.localName.toLowerCase() !== 'html') {
    throw new Error(`Invalid document element ${urlString}`);
  }

  // Determine if a redirect occurred. Compare after removing the hash,
  // because the case where response url differs from the request url only
  // because of the hash is not actually a redirect.
  const urlObject = new URL(urlString);
  urlObject.hash = '';
  const didRedirect = urlObject.href !== response.url;

  // TODO: rename property to didRedirect, documentObject, responseURLString

  return {'doc': doc, 'responseURL': response.url, 'redirected': didRedirect};
};

// Sends a HEAD request for the given image. Ignores response body.
// @param url {String}
// @returns a simple object with props imageSize and imageResponseURL

// TODO: rename param to urlString

favicon.fetchImageHead = async function(url) {

  // TODO: rename to fetchOptions
  const opts = {};
  opts.credentials = 'omit'; // No cookies
  opts.method = 'HEAD';
  opts.headers = {'accept': 'image/*'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const response = await favicon.fetch(url, opts, favicon.fetchImageTimeoutMillis);
  if(!response.ok) {
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  }
  const typeHeader = response.headers.get('Content-Type');
  if(!favicon.isValidMimeType(typeHeader)) {
    throw new Error(`Invalid response type ${typeHeader}`);
  }
  const lenHeader = response.headers.get('Content-Length');
  let lenInt = -1;
  if(lenHeader) {
    try {
      lenInt = parseInt(lenHeader, 10);
    } catch(error) {
    }
  }

  // TODO: rename to responseURLString`
  return {'imageSize:': lenInt, 'imageResponseURL': response.url};
};

// TODO: maybe be more restrictive about allowed content typeHeader
// image/vnd.microsoft.icon
// image/png
// image/x-icon
// image/webp
favicon.isValidMimeType = function(headerValueString) {
  return /^\s*image\//i.test(headerValueString);
};
