import assert from "/src/common/assert.js";
// TODO: be explicit we do not need all the functions here
import * as FetchUtils from "/src/common/fetch-utils.js";
import {parseHTML} from "/src/common/html-utils.js";
import {open as utilsOpen} from "/src/common/indexeddb-utils.js";

// TODO: service should be decoupled from all common libraries and roll its own, to provide a
// more severe service boundary. So it should return its own error codes and make use of its
// own db utils library.
// TODO: breakup the lookup function into smaller functions so it easier to read


export async function open(name = 'favicon-cache', version = 3, timeout = 500) {
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

  if(event.oldVersion < 3) {
    console.debug('oldVersion < 3');
    // In the transition from 2 to 3, there are no changes. I am adding a non-indexed property.
    // TODO: this if block should be removed?
  }
}

// query props:
// conn - the idb database conn, optional
// maxFailureCount, integer
// skipURLFetch boolean
// maxAgeMs
// fetchHTMLTimeoutMs
// fetchImageTimeoutMs,
// minImageSize,
// maxImageSize
// url, URL, required, the webpage to find a favicon for
// document, Document, optional, pre-fetched document if available

const defaultQuerySettings = {
  maxFailureCount: 2,
  maxAge: 1000 * 60 * 60 * 24 * 30,
  skipURLFetch: false,
  fetchHTMLTimeout: 400,
  fetchImageTimeout: 1000,
  minImageSize: 50,
  maxImageSize: 10240
};


// Lookup a favicon
export async function lookup(inputQuery) {

  // Merge settings together. This also helps treat inputQuery as immutable, and
  // supplies defaults.
  const query = Object.assign({}, defaultQuerySettings, inputQuery);

  assert(query.url instanceof URL);
  assert(typeof query.document === 'undefined' || query.document instanceof Document);
  console.log('Favicon lookup', query.url.href);

  const urls = [];
  urls.push(query.url.href);

  let originURL = new URL(query.url.origin);
  let originEntry;

  // Check the cache for the input url
  if(query.conn) {
    const entry = await findEntry(query.conn, query.url);
    if(entry.iconURLString && !isExpired(query.maxAge, entry)) {
      return entry.iconURLString;
    }
    if(originURL.href === query.url.href && entry.failureCount >= query.maxFailureCount) {
      console.debug('Too many failures', query.url.href);
      return;
    }
  }

  // If specified, examine the pre-fetched document
  if(query.document) {
    const iconURL = await searchDocument(query, query.document, query.url);
    if(iconURL) {
      if(query.conn) {
        await putAll(query.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if we reached the max failure count for the input url's origin (if we did not already
  // do the check above because input itself was origin)
  if(query.conn && originURL.href !== query.url.href) {
    originEntry = await findEntry(query.conn, originURL);
    if(originEntry && originEntry.failureCount >= query.maxFailureCount) {
      console.debug('Exceeded max lookup failures', originURL.href);
      return;
    }
  }

  // Try and fetch the html for the url. Non-fatal.
  let response;
  if(!document && !query.skipURLFetch) {
    try {
      response = await FetchUtils.fetchHTML(url, query.fetchHTMLTimeout);
    } catch(error) {
      console.debug(error);
    }
  }

  // Handle redirect
  let responseURL;
  if(response) {
    responseURL = new URL(response.url);

    if(FetchUtils.detectURLChanged(url, responseURL)) {

      // Update the function scope origin url for later
      if(responseURL.origin !== url.origin) {
        originURL = new URL(responseURL.origin);
      }

      // Add response url to the set of distinct urls investigated
      urls.push(responseURL.href);

      // Check the cache for the redirected url
      if(query.conn) {
        let entry = await findEntry(query.conn, responseURL);
        if(entry && entry.iconURLString && !isExpired(query.maxAge, entry)) {
          await putAll(query.conn, [url.href], entry.iconURLString);
          return entry.iconURLString;
        }
      }
    }
  }

  // TODO: this is wrong. query should be treated as immutable. Using a different variable
  // will also avoid any ambiguity.

  // We will be re-using the document, so avoid any ambiguity between a parse failure and
  // whether query.document was specified
  query.document = null;

  // Deserialize the html response. Error is not fatal.
  if(response) {
    try {
      query.document = await parseHTMLResponse(response);
    } catch(error) {
      console.debug(error);
    }
  }

  // Search the document. Errors are not fatal.
  if(query.document) {
    const baseURL = responseURL ? responseURL : query.url;
    let iconURL;
    try {
      iconURL = await searchDocument(query, query.document, baseURL);
    } catch(error) {
      console.debug(error);
    }

    if(iconURL) {
      if(query.conn) {
        await putAll(query.conn, urls, iconURL);
      }
      return iconURL;
    }
  }

  // Check if the origin is in the cache if it is distinct
  if(query.conn && !urls.includes(originURL.href)) {
    originEntry = await findEntry(query.conn, originURL);
    if(originEntry) {
      if(originEntry.iconURLString && !isExpired(query.maxAge, originEntry)) {
        await putAll(query.conn, urls, originEntry.iconURLString);
        return originEntry.iconURLString;
      } else if(originEntry.failureCount >= query.maxFailureCount) {
        console.debug('Exceeded failure count', originURL.href);
        return;
      }
    }
  }

  if(!urls.includes(originURL.href)) {
    urls.push(originURL.href);
  }

  // Check for root directory favicon image
  const baseURL = responseURL ? responseURL : query.url;
  const imageURL = new URL(baseURL.origin + '/favicon.ico');
  response = null;
  try {
    response = await fetchImage(query, imageURL);
  } catch(error) {
    console.debug(error);
  }

  if(response && isAcceptableImageResponse(query, response)) {
    if(query.conn) {
      await putAll(query.conn, urls, response.url);
    }
    return response.url;
  }

  // Handle total lookup failure
  if(query.conn) {
    onLookupFailure(query, originURL, originEntry);
  }
}

function isAcceptableImageResponse(query, response) {
  assert(response instanceof Response);
  // TODO: inline the call, it is simple and is better decoupling. Wait to do this until
  // after some other things settled
  const size = FetchUtils.getContentLength(response);

  // Tolerate NaN as acceptable
  return isNaN(size) || (size >= query.minImageSize && size <= query.maxImageSize);
}

async function fetchImage(query, url) {
  const options = {method: 'head', timeout: query.fetchImageTimeout};
  const response = await FetchUtils.fetchHelper(url, options);

  // TODO: inline this call
  const type = FetchUtils.getMimeType(response);

  // TODO: make this a helper
  if(type && (type.startsWith('image/') || type === 'application/octet-stream')) {
    return response;
  }
}

// TODO: inline
async function parseHTMLResponse(response) {
  assert(response instanceof Repsonse);
  const text = await response.text();

  // TODO: decouple status
  const [status, document, message] = parseHTML(text);
  if(status !== Status.OK) {
    throw new Error('Failed to parse response');
  }

  return document;
}

function isExpired(maxAge, entry) {

  // Tolerate partially corrupted data
  if(!entry.dateUpdated) {
    console.warn('Invalid entry dateUpdated property', entry);
    return false;
  }

  const currentDate = new Date();
  const entryAge = currentDate - entry.dateUpdated;

  // Tolerate partially corrupted data
  if(entryAge < 0) {
    console.warn('Invalid entry dateUpdated property (future)', entry);
    return false;
  }

  return entryAge > maxAge;

}

async function searchDocument(query, document, baseURL) {
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
      const response = await fetchImage(query, url);
    } catch(error) {
      if(isAcceptableImageResponse(query, response)) {
        return response.url;
      }
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

function onLookupFailure(query, originURL, originEntry) {
  if(entry) {
    const newEntry = {};
    newEntry.pageURLString = entry.pageURLString;
    newEntry.dateUpdated = new Date();
    newEntry.iconURLString = entry.iconURLString;
    if('failureCount' in entry) {
      if(entry.failureCount <= this.kMaxFailureCount) {
        newEntry.failureCount = entry.failureCount + 1;
        putEntry(query.conn, newEntry);
      }
    } else {
      newEntry.failureCount = 1;
      putEntry(query.conn, newEntry);
    }
  } else {
    const newEntry = {};
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    putEntry(query.conn, newEntry);
  }
}

function resolveURLString(url, baseURL) {
  assert(baseURL instanceof URL);
  if(typeof url === 'string' && url.trim()) {
    try {
      return new URL(url, baseURL);
    } catch(error) {

    }
  }
}

// Clears the favicon object store.
// @param conn {IDBDatabase} optional open database connection, a connection is dynamically
// created, used, and closed, if not specified
export async function clear(conn) {
  console.log('Clearing favicon store');
  const dconn = conn ? conn : await open();
  await clearPromise(dconn);
  if(!conn) {
    dconn.close();
  }
  console.log('Cleared favicon store');
}

function clearPromise(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('favicon-cache', 'readwrite');
    const store = txn.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Not public, no direct query access
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

// @param conn {IDBDatabase} optional, otherwise created dynamically
export async function compact(conn) {
  console.log('Compacting favicon store...');
  let cutoffTime = Date.now() - defaultQuerySettings.maxAge;
  cutoffTime = cutoffTime < 0 ? 0 : cutoffTime;
  const cutoffDate = new Date(cutoffTime);

  const dconn = conn ? conn : await open();
  const count = await compactPromise(dconn, cutoffDate);
  if(!conn) {
    dconn.close();
  }

  console.log('Compacted favicon store, deleted %d entries', count);
}

// Query for expired entries and delete them
function compactPromise(conn, cutoffDate) {
  return new Promise((resolve, reject) => {
    let count = 0;
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = () => resolve(count);
    txn.onerror = () => reject(txn.error);
    const store = txn.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const range = IDBKeyRange.upperBound(cutoffDate);
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if(cursor) {
        console.debug('Deleting expired favicon entry', cursor.value);
        count++;
        cursor.delete();
        cursor.continue();
      }
    };
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
    const txn = conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);

    const store = txn.objectStore('favicon-cache');
    const currentDate = new Date();

    for(const urlString of urlStrings) {
      const entry = {
        pageURLString: urlString,
        iconURLString: iconURLString,
        dateUpdated: currentDate,
        failureCount: 0
      };

      store.put(entry);
    }
  });
}
