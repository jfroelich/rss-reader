'use strict';

// import fetch.js
// import html-parser.js
// import rbl.js
// import url.js

// TODO: use a queue or somehow join a request queue that merges lookups to the same origin

// After 2 lookups stop trying (comparison is <=)
const FAVICON_MAX_ORIGIN_FAILURE_COUNT = 2;


// TODO: move out url and doc, those should be params, and this should be a
// this-bound context instead. Alternatively, this whole thing should be
// something like FaviconLookupRequest, and faviconLookup should be a member
// function.
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
    maxAgeMs = FAVICON_MAX_AGE_MS;
  }

  if(typeof fetchHTMLTimeoutMs === 'undefined') {
    fetchHTMLTimeoutMs = 4000;
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
    const iconURLString = await faviconDbFindLookupURL(query.conn, query.url, maxAgeMs);
    if(iconURLString) {
      return iconURLString;
    }
  }

  // If the query included a pre-fetched document, search it
  if(query.document) {
    console.debug('faviconLookup searching pre-fetched document for url', urlObject.href);
    const iconURLString = await faviconSearchDocument(document, query.conn, query.url, urls);
    if(iconURLString) {
      console.debug('faviconLookup found favicon in pre-fetched document', urlObject.href,
        iconURLString);
      return iconURLString;
    }
  }

  // Before fetching, check for origin max failure count in db
  // TODO: this should probably somehow expire to allow eventual success
  if(query.conn) {
    const originURL = new URL(urlObject.origin);
    const originEntry = await faviconDbFindEntry(query.conn, originURL);
    if(originEntry && originEntry.failureCount >= FAVICON_MAX_ORIGIN_FAILURE_COUNT) {
      console.debug('canceling lookup, too many failures on origin', originURL.href);
      return;
    }
  }

  // TODO: before fetching, add sniff logic. Stop trying to fetch xml feeds.

  // Get the response for the url. Trap any fetch errors, a fetch error is
  // non-fatal to lookup.
  let response;

  if(!query.document && !query.skipURLFetch) {
    try {
      response = await fetchHTML(urlObject.href, fetchHTMLTimeoutMs);
    } catch(error) {
      // A fetch error is non-fatal to lookup unless it is an assertion failure
      if(typeof error === AssertionError) {
        throw error;
      } else {
        console.warn(error);
      }
    }
  }

  if(response) {
    let responseURLObject;
    if(response.redirected) {
      responseURLObject = new URL(response.responseURL);
      urls.add(responseURLObject.href);

      // Check the cache for the redirect url
      if(query.conn) {
        const iconURLString = await faviconDbFindRedirectURL(query.conn, urlObject, response,
          maxAgeMs);

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
        document = HTMLParser.parseDocumentFromString(text);
      } catch(error) {
        if(isUncheckedError(error)) {
          throw error;
        } else {
          // Treat parse error as non-fatal. In this case document is undefined
          console.warn(error);
        }
      }

      if(document) {
        const baseURL = responseURLObject ? responseURLObject : urlObject;
        const iconURLString = await faviconSearchDocument(document, query.conn, baseURL, urls);
        if(iconURLString) {
          return iconURLString;
        }
      }
    }
  }

  // Check the cache for the origin url
  if(query.conn && !urls.has(urlObject.origin)) {
    const iconURLString = await faviconDbFindOriginURL(query.conn, urlObject.origin, urls,
      maxAgeMs);
    if(iconURLString) {
      return iconURLString;
    }

    // TEMP: new functionality
    // Issue #453
    // Before fetching an origin, check if an entry exists with a failure counter. If not, proceed.
    // If a failure counter exists, and it is greater than some threshold, do not fetch, do not
    // increment the counter, just fail.

    // Due to some bad design at the moment, query again for the origin entry.
    // TODO: this should not re-query. Refactor faviconDbFindOriginURL so that the entry lookup
    // is done externally and shared

    const originURLObject = new URL(urlObject.origin);
    console.debug('checking for cached entry for failure', originURLObject.href);

    const originEntry = await faviconDbFindEntry(query.conn, originURLObject);

    if(originEntry) {
      // In the case of checking for the failure counter, I do not think it is necessary to check
      // whether the entry is expired. At least, not at the moment. Not thinking clearly.
      if(originEntry.failureCount >= FAVICON_MAX_ORIGIN_FAILURE_COUNT) {
        console.debug('reached max failure count for origin lookup', originEntry);

        // TODO: Issue #453. Consider distinguishing between a fetch failure, and a
        // too-many-failed-requests failure. Not sure how. Perhaps as an exception.
        // I think here is where instead of returning I just throw an exception? I really do not
        // like throwing an exception in a non-exceptional case.

        // Exit early to avoid the call to faviconLookupOrigin
        return;
      }
    } else {
      console.debug('no entry found to check failure count', originURLObject.href);
    }
  }

  // Check for /favicon.ico
  const iconURLString = await faviconLookupOrigin(query.conn, urlObject, urls, fetchImageTimeoutMs,
    minImageSize, maxImageSize);
  return iconURLString;
}

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
function faviconIsEntryExpired(entry, currentDate, maxAgeMs) {
  const entryAgeMs = currentDate - entry.dateUpdated;
  return entryAgeMs > maxAgeMs;
}


async function faviconDbFindLookupURL(conn, urlObject, maxAgeMs) {
  assert(isOpenDB(conn));

  const entry = await faviconDbFindEntry(conn, urlObject);
  if(!entry) {
    return;
  }

  const currentDate = new Date();
  if(faviconIsEntryExpired(entry, currentDate, maxAgeMs)) {
    return;
  }

  console.log('faviconDbFindLookupURL found cached entry', entry.pageURLString,
    entry.iconURLString);
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
  // NOTE: conn definedness and state is not asserted because we allow for
  // cacheless lookup. This was previously the source of a bug.
  assert(baseURLObject instanceof URL);
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

    console.debug('candidate:', selector, element.outerHTML);

    let hrefString = element.getAttribute('href');

    // Avoid passing empty string to URL constructor. The selector criterion
    // only checks attribute presence
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

    console.log('found favicon <link>', baseURLObject.href, iconURLObject.href);

    // TODO: move this out so that faviconSearchDocument is not async
    if(conn) {
      // conn definedness and state assertion delegated to faviconDbPutEntries
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

async function faviconLookupOrigin(conn, urlObject, urls, fetchImageTimeoutMs, minImageSize,
  maxImageSize) {

  const imageURLString = urlObject.origin + '/favicon.ico';
  const fetchPromise = fetchImageHead(imageURLString, fetchImageTimeoutMs);
  let response;
  try {
    response = await fetchPromise;
  } catch(error) {
    // This is spamming the console so disabled for now.
    // console.warn(error);

    // TEMP: Issue #453. When failing to fetch an origin (not the input url), increment the
    // failure counter. The failure counter is limited to origin lookups to avoid storing too many
    // entries.

    // TODO: just realized, I am going to be storing a null icon property. Everything needs to
    // account for that.

    if(conn) {
      console.debug('origin fetch error, storing failure possibly', error);
      // NOTE: if this fails it throws its own exception

      // NOTE: pass the origin url, not the image url

      await faviconDbAddOriginFetchFailure(conn, urlObject.origin);
    } else {
      console.debug('origin fetch error but no connection available');
    }


    return;
  }

  if(response.size === FETCH_UNKNOWN_CONTENT_LENGTH ||
    (response.size >= minImageSize && response.size <= maxImageSize)) {
    if(conn) {

      // TEMP: ISSUE #453
      // For every fetch success, reset the failure counter of the entry to 0.
      // When creating a new entry, initialize the failure counter to 0.
      // TODO: this needs to only happen for the origin url

      await faviconDbPutEntries(conn, response.responseURL, urls);
    }
    console.log('Found origin icon', urlObject.origin, response.responseURL);
    return response.responseURL;
  }
}

// TEMP: new functionality, not fully implemented nor tested
// Issue #453
async function faviconDbAddOriginFetchFailure(conn, originURLString) {

  // The caller should never call this with an undefined or closed connection
  assert(isOpenDB(conn));

  // TODO: Either store a new entry, or increment the failure counter of an existing entry

  // Search for an existing entry

  console.debug('searching with value', originURLString);

  // TODO: if this search was done previously by the caller it would make sense to avoid the
  // additional lookup, perhaps with an entry parameter to this function. I am concerned there are
  // too many database round trips and want to minimize the number.
  const originURL = new URL(originURLString);


  const entry = await faviconDbFindEntry(conn, originURL);

  if(entry) {
    const newEntry = {};
    newEntry.pageURLString = entry.pageURLString;
    newEntry.dateUpdated = new Date();

    // If the entry previously had an icon, keep it.
    // TODO: is this correct? needed? important? Not sure. Kinda not thinking clearly atm.
    newEntry.iconURLString = entry.iconURLString;

    // Increment the failure count
    if('failureCount' in entry && typeof entry.failureCount === 'number') {

      if(entry.failureCount <= FAVICON_MAX_ORIGIN_FAILURE_COUNT) {
        console.debug('storing incremented failure count of origin fetch', newEntry.pageURLString);
        newEntry.failureCount = entry.failureCount + 1;
        await faviconDbPutEntry(conn, newEntry);
      } else {
        console.debug('noop, max fail count reached for origin fetch', newEntry.pageURLString);
        // We reached the max failure count. This becomes a no-operation.
      }
    } else {
      console.debug('storing initial failure of origin fetch', newEntry.pageURLString);
      newEntry.failureCount = 1;
      await faviconDbPutEntry(conn, newEntry);
    }

  } else {
    // Store a new entry representing the failed origin lookup

    // TODO: this is storing the wrong thing. It is storing the url with '/favicon.ico' in it.
    // it should be storing a different page url
    // changed, let's see if this fixed it
    // changed again now that passing in origin instead of imageURLString
    // changed again, pass href so it matches lookup. .origin does not include path leading slash

    console.debug('storing failed entry with page url', originURL);

    const newEntry = {};

    //newEntry.pageURLString = new URL(originURL.origin).href;
    newEntry.pageURLString = originURL.href;
    newEntry.iconURLString = undefined;
    newEntry.dateUpdated = new Date();
    newEntry.failureCount = 1;
    await faviconDbPutEntry(conn, newEntry);
  }
}
