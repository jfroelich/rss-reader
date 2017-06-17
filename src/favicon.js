// See license.md

'use strict';

// TODO: review and remove all attempts at abstracting away indexedDB


const jrFaviconCacheName = 'favicon-cache';
const jrFaviconCacheVersion = 2;

// The time that elapses before entry is considered
// expired, that is by default 30 days (in ms)
const jrFaviconCacheMaxAge = 1000 * 60 * 60 * 24 * 30;

// Byte size ends points for images. Images outside these bounds are
// considered invalid icons.
const jrFaviconMinSize = 49;
const jrFaviconMaxSize = 10 * 1024 + 1;

// Default timeouts for fetching (in ms)
const jrFaviconFetchHTMLTimeout = 1000;
const jrFaviconFetchImageTimeout = 100;

// TODO: this function is simply too large and needs to be broken up into
// helper functions a bit
// TODO: logging should be optional, maybe have a console parameter where log
// only occurs if parameter defined
// Given a url, lookup the associated favicon url. Tries to follow the spec by
// first checking for the icon in the page, then checking in the domain root.
// Tries to use a cache to speed up queries.
// @param conn {IDBDatabase} an open indexedDB connection
// @param urlObject {URL} the url to lookup
// @returns {String} the icon url or null/undefined
async function jrFaviconLookup(conn, urlObject) {
  console.log('LOOKUP', urlObject.href);

  // TODO: this should probably be renamed to just 'urls' as there is no
  // need for the extra qualification. Need to double check this function
  // does not use 'urls' elsewhere first (it does)
  const uniqURLs = [urlObject.href];
  const currentDate = new Date();

  // Lookup the url in the cache
  const entry = await jrFaviconFindEntry(urlObject.href);
  if(entry && !jrFaviconIsExpired(entry, currentDate))
    return entry.iconURLString;

  // If we did not find a cached entry, or if we found a cached entry but it
  // is expired, then plan on fetching. Before fetching, check if we are
  // offline so as to distinguish offline from other fetch errors.
  if('onLine' in navigator && !navigator.onLine)
    return;

  // Fetch the html of the url. Fetch errors are non-fatal.
  // TODO: redirected is a boolean, use boolean naming convention like
  // didRedirect
  let doc, responseURL, redirected = false;
  try {
    ({doc, responseURL, redirected} =
      await jrFaviconFetchDocument(urlObject.href));
    responseURL = new URL(responseURL);
  } catch(error) {
    console.warn(error, urlObject.href);
  }

  // If redirected, add the response url to unique urls
  if(redirected)
    uniqURLs.push(responseURL.href);

  // If the fetch failed but we have an expired entry, remove it
  if(entry && !doc) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    await jrFaviconRemoveEntry(tx, urlObject.href);
  }

  const baseURLObject = redirected ? responseURL : urlObject;
  const docIconURL = jrFaviconFindIconInDocument(doc, baseURLObject);

  // If we found an in page icon, update the cache and resolve
  // TODO: can also store origin in cache if it distinct? would need to move
  // some origin url code upward
  if(docIconURL) {
    console.debug('Found favicon <link>', urlObject.href, docIconURL.href);

    // TODO: these 3 statements should be a call to putAll
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const proms = uniqURLs.map((urlObject) => jrFaviconPutEntry(tx, urlObject,
      docIconURL.href));
    await Promise.all(proms);
    return docIconURL.href;
  }

  // If we did not find an in page icon, and we redirected, check cache for
  // redirect
  let redirectEntry;
  if(redirected)
    redirectEntry = await jrFaviconFindEntry(responseURL.href);

  // If the redirect exists and is not expired, then resolve
  // TODO: this condition should only be tested if redirected
  if(redirectEntry && !jrFaviconIsExpired(redirectEntry, currentDate))
    return redirectEntry.iconURLString;

  // If the origin is different from the request url and the redirect url,
  // then check the cache for the origin
  let originEntry;
  if(!uniqURLs.includes(urlObject.origin)) {
    uniqURLs.push(urlObject.origin);
    originEntry = await jrFaviconFindEntry(urlObject.origin);
  }

  // If an origin entry exists and is not expired, then update entries for the
  // other urls and resolve
  if(originEntry && !jrFaviconIsExpired(originEntry, currentDate)) {
    const iconURL = originEntry.iconURLString;
    const tx = conn.transaction('favicon-cache', 'readwrite');
    if(redirected) {
      // TODO: this should be a call to some type of put all function
      const urls = [urlObject.href, responseURL.href];
      const proms = proms.map((urlObject) =>
        jrFaviconPutEntry(tx, urlObject, iconURL));
      await Promise.all(proms);
    } else {
      await jrFaviconPutEntry(tx, urlObject.href, iconURL);
    }

    return iconURL;
  }

  // Fall back to checking domain root
  const rootImageURL = urlObject.origin + '/favicon.ico';
  let imageSize, imageResponseURL;
  try {
    ({imageSize, imageResponseURL} =
      await jrFaviconFetchImageHead(rootImageURL));
  } catch(error) {
    console.warn(error);
  }

  const sizeInRange = imageSize === -1 ||
    (imageSize > jrFaviconMinSize && imageSize < jrFaviconMaxSize);

  // If fetched and size is in range, then resolve to it
  if(imageResponseURL && sizeInRange) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const proms = uniqURLs.map((urlObject) => jrFaviconPutEntry(tx, urlObject,
      imageResponseURL));
    await Promise.all(proms);
    return imageResponseURL;
  }

  // Remove entries we know that exist but are expired
  const expiredURLs = [];
  if(entry)
    expiredURLs.push(entry.pageURLString);
  if(redirectEntry)
    expiredURLs.push(redirectEntry.pageURLString);
  if(originEntry)
    expiredURLs.push(originEntry.pageURLString);
  await jrFaviconRemoveEntries(expiredURLs);
  return null;
}

async jrFaviconCreateAlarm(periodInMinutes) {
  const alarm = await jrUtilsGetAlarm('compact-favicons');
  if(alarm)
    return;
  console.debug('Creating alarm compact-favicons');
  chrome.alarms.create('compact-favicons',
    {'periodInMinutes': periodInMinutes});
}

// Handle an alarm event
async jrFaviconOnAlarm(alarm) {
  // This can be called for any alarm, so reject others
  if(alarm.name !== 'compact-favicons')
    return;
  let conn;

  try {
    conn = await jrFaviconConnect();
    await jrFaviconCompact(conn);
  } catch(error) {
    console.warn(error);
  } finally {
    if(conn)
      conn.close();
  }
}

chrome.alarms.onAlarm.addListener(jrFaviconOnAlarm);

// Returns true if the entry is expired. An entry is expired if the difference
// between today's date and the date the entry was last updated is greater than
// max age.
function jrFaviconIsExpired(entry, currentDate) {
  const age = currentDate - entry.dateUpdated;
  return age > jrFaviconCacheMaxAge;
}

function jrFaviconConnect() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(jrFaviconCacheName, jrFaviconCacheVersion);
    request.onupgradeneeded = jrFaviconOnUpgradeNeeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => console.warn('Connection blocked');
  });
}

// Upgrades the internal database
function jrFaviconOnUpgradeNeeded(event) {
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
}

function jrFaviconFindEntry(conn, urlString) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Adds or replaces an entry in the cache
// TODO: maybe rename props to pageURL and iconURL
function jrFaviconPutEntry(tx, pageURL, iconURL) {
  return new Promise((resolve, reject) => {
    const entry = {
      'pageURLString': pageURL,
      'iconURLString': iconURL,
      'dateUpdated': new Date()
    };
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

function jrFaviconRemoveEntry(tx, pageURL) {
  return new Promise((resolve, reject) => {
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(pageURL);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

// Get all entries in the database as an array
function jrFaviconGetEntries(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: age should probably be a parameter to this function, that if
// not defined, defaults to the default age
function jrFaviconGetExpiredEntries(conn) {
  return new Promise((resolve, reject) => {
    let cutoffTime = Date.now() - jrFaviconCacheMaxAge;
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

// Returns an array of the results of remove calls
// @param urls an array of urls
async function jrFaviconRemoveEntries(conn, urls) {
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const promises = urls.map((url) => jrFaviconRemoveEntry(tx, url));
  return await Promise.all(promises);
}

// Finds all expired entries in the database and removes them
async function jrFaviconCompact(conn) {
  const expiredEntries = await jrFaviconGetExpiredEntries(conn);
  const expiredURLs = expiredEntries.map((e) => e.pageURLString);
  const resolutions = await jrFaviconRemoveEntries(conn, expiredURLs);
  return resolutions.length;
}


// Search for icon links in the document, and ensure the links are absolute.
// Use the first valid link found.
// TODO: use querySelectorAll?
function jrFaviconFindIconInDocument(doc, baseURLObject) {
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];
  let docIconURL;

  if(!doc || !doc.head)
    return undefined;

  for(let selector of selectors) {
    docIconURL = jrFaviconMatch(doc.head, selector, baseURLObject);
    if(docIconURL)
      return docIconURL;
  }

  return undefined;
}

// Looks for a <link> tag within an ancestor element
// @param ancestor {Element}
// @param selector {String}
// @param baseURLObject {URL}
function jrFaviconMatch(ancestor, selector, baseURLObject) {
  const element = ancestor.querySelector(selector);
  if(!element)
    return;
  const href = (element.getAttribute('href') || '').trim();
  // Without this check the URL constructor creates a clone of the base url
  if(!href)
    return;
  try {
    return new URL(href, baseURLObject);
  } catch(error) {
    //console.warn(error);
  }
  return null;
}

// Rejects after a timeout
function jrFaviconFetchTimeout(url, timeout) {
  return new Promise((resolve, reject) => {
    setTimeout(reject, timeout, new Error(`Request timed out ${url}`));
  });
}


// Race a timeout against a fetch. fetch does not support timeout (yet?).
// A timeout will not cancel/abort the fetch, but will ignore it.
// A timeout rejection results in this throwing an uncaught error
// Timeout is optional
async function jrFaviconFetch(url, options, timeout) {
  let response;
  if(timeout) {
    const promises = [
      fetch(url, options),
      jrFaviconFetchTimeout(url, timeout)
    ];
    response = await Promise.race(promises);
  } else {
    response = await fetch(url, opts);
  }
  return response;
}

// Fetches the html Document for the given url
// @param url {String}
// TODO: maybe I can avoid parsing and just search raw text for
// <link> tags, the accuracy loss may be ok given the speed boost
// TODO: use streaming text api, stop reading on </head>
async jrFaviconFetchDocument(url) {
  const opts = {
    'credentials': 'omit',
    'method': 'get',
    'headers': {'Accept': 'text/html'},
    'mode': 'cors',
    'cache': 'default',
    'redirect': 'follow',
    'referrer': 'no-referrer'
  };

  const response = await jrFaviconFetch(url, opts, jrFaviconFetchHTMLTimeout);
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  if(response.status === 204)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  const typeHeader = response.headers.get('Content-Type');
  if(!/^\s*text\/html/i.test(typeHeader))
    throw new Error(`Invalid content type "${typeHeader}" ${url}`);
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  if(doc.documentElement.localName.toLowerCase() !== 'html')
    throw new Error(`Invalid document element ${url}`);

  // Determine if a redirect occurred. Compare after removing the hash,
  // because the case where response url differs from the request url only
  // because of the hash is not actually a redirect.
  const urlObject = new URL(url);
  urlObject.hash = '';
  const redirected = urlObject.href !== response.url;

  return {'doc': doc, 'responseURL': response.url, 'redirected': redirected};
}

// Sends a HEAD request for the given image. Ignores response body.
// @param url {String}
// @returns a simple object with props imageSize and imageResponseURL
async function jrFaviconFetchImageHead(url) {
  const opts = {};
  opts.credentials = 'omit'; // No cookies
  opts.method = 'HEAD';
  opts.headers = {'accept': 'image/*'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const response = await jrFaviconFetch(url, opts, jrFaviconFetchImageTimeout);
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);
  const typeHeader = response.headers.get('Content-Type');
  if(!jrFaviconIsValidMimeType(typeHeader))
    throw new Error(`Invalid response type ${typeHeader}`);
  const lenHeader = response.headers.get('Content-Length');
  let lenInt = -1;
  if(lenHeader) {
    try {
      lenInt = parseInt(lenHeader, 10);
    } catch(error) {
    }
  }

  return {'imageSize:': lenInt, 'imageResponseURL': response.url};
}

// TODO: maybe be more restrictive about allowed content typeHeader
// image/vnd.microsoft.icon
// image/png
// image/x-icon
// image/webp
function jrFaviconIsValidMimeType(headerValueString) {
  return /^\s*image\//i.test(headerValueString);
}
