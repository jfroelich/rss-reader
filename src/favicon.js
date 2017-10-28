'use strict';

// import base/indexeddb.js
// import base/status.js
// import fetch/fetch.js
// import html.js
// import url.js

// TODO: use status codes throughout. First update fetch.js to use status codes.


// 30 days in ms, used by both lookup and compact to determine whether a
// cache entry expired
const FAVICON_DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Opens a connection to the favicon database
// @throws {Error} invalid timeout (any other errors occur within promise)
// @returns {Promise} resolves to open IDBDatabase instance
function favicon_db_open() {
  const name = 'favicon-cache';
  const version = 2;
  const timeout_ms = 500;
  return indexeddb_open(name, version, favicon_db_onupgradeneeded, timeout_ms);
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
  this.skip_url_fetch = false;

  // These all store numbers
  this.max_age_ms = undefined;
  this.fetch_html_timeout_ms = undefined;
  this.fetch_image_timeout_ms = undefined;
  this.min_image_size = undefined;
  this.max_image_size = undefined;
}

// Looks up the favicon url for a given web page url
// @param query {FaviconQuery}
// @returns {String} the favicon url if found, otherwise undefined
// TODO: return status and icon instead of throwing errors
async function favicon_lookup(query) {
  console.assert(query instanceof FaviconQuery);
  console.log('favicon_lookup', query.url.href);

  // TODO: rather than declare local variables, just use the query parameter
  const url_object = query.url;
  let max_age_ms = query.max_age_ms;
  let fetch_html_timeout_ms = query.fetch_html_timeout_ms;
  let fetch_image_timeout_ms = query.fetch_image_timeout_ms;
  let min_image_size = query.min_image_size;
  let max_image_size = query.max_image_size;

  if(typeof max_age_ms === 'undefined') {
    max_age_ms = FAVICON_DEFAULT_MAX_AGE_MS;
  }

  if(typeof fetch_html_timeout_ms === 'undefined') {
    fetch_html_timeout_ms = 1000;
  }

  if(typeof fetch_image_timeout_ms === 'undefined') {
    fetch_image_timeout_ms = 200;
  }

  if(typeof min_image_size === 'undefined') {
    min_image_size = 50;
  }

  if(typeof max_image_size === 'undefined') {
    max_image_size = 10240;
  }

  // TODO: use an array
  const urls = new Set();
  urls.add(url_object.href);

  // Check the cache for the input url
  if(query.conn) {
    const icon_url_string = await favicon_db_find_lookup_url(query.conn,
      query.url, max_age_ms);
    if(icon_url_string) {
      return icon_url_string;
    }
  }

  // If the query included a pre-fetched document, search it
  if(query.document) {
    console.debug('favicon_lookup searching pre-fetched document for url',
      url_object.href);
    const icon_url_string = await favicon_search_document(document, query.conn,
      query.url, urls);
    if(icon_url_string) {
      console.debug('favicon_lookup found favicon in pre-fetched document',
        url_object.href, icon_url_string);
      return icon_url_string;
    }
  }

  // Get the response for the url. Trap any fetch errors, a fetch error is
  // non-fatal to lookup.
  let response;

  // Only fetch if a pre-fetched document was not provided
  if(!query.document && !query.skip_url_fetch) {
    try {
      response = await fetch_html(url_object.href, fetch_html_timeout_ms);
    } catch(error) {
      // Do not warn. Network errors appear in the console.
      // Do not exit early. A fetch error is non-fatal to lookup.
    }
  }

  if(response) {
    let response_url_object;

    if(response.redirected) {
      response_url_object = new URL(response.response_url);
      urls.add(response_url_object.href);

      // Check the cache for the redirect url
      if(query.conn) {
        const icon_url_string = await favicon_db_find_redirect_url(query.conn,
          url_object, response, max_age_ms);

        // Return the cached favicon url for the redirect url
        if(icon_url_string) {
          return icon_url_string;
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
      // Parse the text into an HTML document
      const [status, document] = html_parse_from_string(text);

      if(status === STATUS_OK) {

        // Use the response url as the base url if available
        let base_url_object = response_url_object ? response_url_object :
          url_object;

        // Check the fetched document for a <link> tag
        const icon_url_string = await favicon_search_document(document,
          conn, base_url_object, urls);
        if(icon_url_string) {
          return icon_url_string;
        }
      }
    }
  }

  // Check the cache for the origin url
  if(query.conn && !urls.has(url_object.origin)) {
    const icon_url_string = await favicon_db_find_origin_url(query.conn,
      url_object.origin, urls, max_age_ms);
    if(icon_url_string) {
      return icon_url_string;
    }
  }

  // Check for /favicon.ico
  const icon_url_string = await favicon_lookup_origin(query.conn, url_object,
    urls, fetch_image_timeout_ms, min_image_size, max_image_size);
  return icon_url_string;
}

async function favicon_db_find_lookup_url(conn, url_object, max_age_ms) {
  console.assert(indexeddb_is_open(conn));

  const entry = await favicon_db_find_entry(conn, url_object);
  if(!entry) {
    return;
  }

  const current_date = new Date();
  if(favicon_is_entry_expired(entry, current_date, max_age_ms)) {
    return;
  }

  console.log('favicon_db_find_lookup_url found cached entry',
    entry.pageURLString, entry.iconURLString);
  return entry.iconURLString;
}

async function favicon_db_find_redirect_url(conn, url_object, response,
  max_age_ms) {
  const response_url_object = new URL(response.response_url);
  const entry = await favicon_db_find_entry(conn, response_url_object);
  if(!entry) {
    return;
  }

  const current_date = new Date();
  if(favicon_is_entry_expired(entry, current_date, max_age_ms)) {
    return;
  }

  console.log('found redirect in cache', entry);
  const entries = [url_object.href];
  await favicon_db_put_entries(conn, entry.iconURLString, entries);
  return entry.iconURLString;
}

// @param document {Document}
// @param conn {IDBDatabase}
// @param base_url_object {URL}
// @param urls {Set}
// @returns {String} a favicon url
async function favicon_search_document(document, conn, base_url_object, urls) {
  console.assert(document instanceof Document);
  console.assert(indexeddb_is_open(conn));
  console.assert(url_is_url_object(base_url_object));
  console.assert(urls);

  if(!document.head) {
    return;
  }

  let icon_url_object;

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
    let href_string = element.getAttribute('href');
    if(!href_string) {
      continue;
    }

    href_string = href_string.trim();
    if(!href_string) {
      continue;
    }

    try {
      icon_url_object = new URL(href_string, base_url_object);
    } catch(error) {
      continue;
    }

    console.log('found favicon <link>', base_url_object.href,
      icon_url_object.href);

    // TODO: move this out so that search_document is not async
    if(conn) {
      await favicon_db_put_entries(conn, icon_url_object.href, urls);
    }
    return icon_url_object.href;
  }
}

async function favicon_db_find_origin_url(conn, origin_url_string, urls,
  max_age_ms) {
  const origin_url_object = new URL(origin_url_string);
  const origin_entry = await favicon_db_find_entry(conn, origin_url_object);
  const current_date = new Date();
  if(!origin_entry) {
    return;
  }

  if(favicon_is_entry_expired(origin_entry, current_date, max_age_ms)) {
    return;
  }

  console.log('Found non-expired origin entry in cache', origin_url_string,
    origin_entry.iconURLString);


  // origin is not in urls, and we know it is distinct, existing, and fresh
  await favicon_db_put_entries(conn, origin_entry.iconURLString, urls);
  return origin_entry.iconURLString;
}

async function favicon_lookup_origin(conn, url_object, urls,
  fetch_image_timeout_ms, min_image_size, max_image_size) {
  const img_url_string = url_object.origin + '/favicon.ico';
  const fetch_promise = fetch_image_head(img_url_string,
    fetch_image_timeout_ms);
  let response;
  try {
    response = await fetch_promise;
  } catch(error) {
    // This is spamming the console so disabled for now. Eventually this should
    // work using status, and return codes. That needs to wait until
    // fetch_image_head returns a status code.
    //console.warn(error);
    return;
  }

  if(response.size === FETCH_UNKNOWN_CONTENT_LENGTH ||
    (response.size >= min_image_size && response.size <= max_image_size)) {
    if(conn) {
      await favicon_db_put_entries(conn, response.response_url, urls);
    }
    console.log('Found origin icon', url_object.href, response.response_url);
    return response.response_url;
  }
}


async function favicon_db_setup() {
  let conn;
  try {
    conn = await favicon_db_open();
  } finally {
    if(conn) {
      conn.close();
    }
  }
}

function favicon_db_onupgradeneeded(event) {
  const conn = event.target.result;
  console.log('creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    console.log('favicon_db_onupgradeneeded creating favicon-cache');

    store = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    console.log('favicon_db_onupgradeneeded creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }
}

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
function favicon_is_entry_expired(entry, current_date, max_age_ms) {
  const entry_age_ms = current_date - entry.dateUpdated;
  return entry_age_ms > max_age_ms;
}

function favicon_db_clear(conn) {
  console.assert(conn instanceof IDBDatabase);
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function favicon_db_find_entry(conn, url_object) {
  console.assert(conn instanceof IDBDatabase);
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(url_object.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function favicon_db_find_expired_entries(conn, max_age_ms) {
  console.assert(conn instanceof IDBDatabase);
  if(typeof max_age_ms === 'undefined') {
    max_age_ms = FAVICON_DEFAULT_MAX_AGE_MS;
  }

  return new Promise(function(resolve, reject) {
    let cutoff_time_ms = Date.now() - max_age_ms;
    cutoff_time_ms = cutoff_time_ms < 0 ? 0 : cutoff_time_ms;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const cutoff_time_date = new Date(cutoff_time_ms);
    const range = IDBKeyRange.upperBound(cutoff_time_date);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });
}

function favicon_db_remove_entries_with_urls(conn, page_urls) {
  console.assert(conn instanceof IDBDatabase);
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of page_urls)
      store.delete(url);
  });
}

function favicon_db_put_entries(conn, icon_url, page_urls) {
  console.assert(conn instanceof IDBDatabase);
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    const current_date = new Date();
    for(const url of page_urls) {
      const entry = {};
      entry.pageURLString = url;
      entry.iconURLString = icon_url;
      entry.dateUpdated = current_date;
      store.put(entry);
    }
  });
}

// Finds expired entries in the database and removes them
// TODO: return status intsead
async function favicon_compact_db(conn, max_age_ms) {
  console.assert(conn instanceof IDBDatabase);

  const expired_entries = await favicon_db_find_expired_entries(conn,
    max_age_ms);

  const urls = [];
  for(const entry of expired_entries) {
    urls.push(entry.pageURLString);
  }

  const resolutions = await favicon_db_remove_entries_with_urls(conn, urls);
  return resolutions.length;
}
