'use strict';

// Requires
// assert.js
// debug.js
// fetch.js
// html-parse.js

const FAVICON_DEBUG = false;

// 30 days in ms, used by both lookup and compact to determine whether a
// cache entry expired
const FAVICON_DEFAULT_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Looks up the favicon url for a given web page url
// @returns {String} the favicon url if found, otherwise undefined
// TODO: return status and icon instead of throwing errors
async function favicon_lookup(conn, url_object, max_age_ms,
  fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size, max_img_size) {

  // TODO: delegate assetion if not reasoned about locally?
  ASSERT(idb_conn_is_open(conn));

  if(FAVICON_DEBUG)
    DEBUG('favicon lookup', url_object.href);
  if(typeof max_age_ms === 'undefined')
    max_age_ms = FAVICON_DEFAULT_MAX_AGE_MS;
  if(typeof fetch_html_timeout_ms === 'undefined')
    fetch_html_timeout_ms = 1000;
  if(typeof fetch_img_timeout_ms === 'undefined')
    fetch_img_timeout_ms = 200;
  if(typeof min_img_size === 'undefined')
    min_img_size = 50;
  if(typeof max_img_size === 'undefined')
    max_img_size = 10240;

  // TODO: maybe this is always overkill and not needed. In fact I am
  // pretty sure it is overkill. We are dealing with a very small number
  // of urls. Switch back to an array.
  const urls = new Set();
  urls.add(url_object.href);

  // Step 1: check the cache for the input url
  // NOTE: this happens prior to checking whether we are online.
  // Cache lookups still work offline.
  if(conn) {
    const icon_url_string = await favicon_db_find_lookup_url(conn, url_object,
      max_age_ms);
    if(icon_url_string)
      return icon_url_string;
  }


  // TODO: inline the silent function, it is just a simple try catch and it
  // is not adding much value or encapsulating much of anything
  const response = await favicon_fetch_doc_silently(url_object,
    fetch_html_timeout_ms);
  if(response) {
    // Step 2: check the cache for the redirect url
    if(conn && response.redirected) {
      const response_url_object = new URL(response.response_url);
      urls.add(response_url_object.href);
      const icon_url_string = await favicon_db_find_redirect_url(conn,
        url_object, response, max_age_ms);
      if(icon_url_string)
        return icon_url_string;
    }

    // Step 3: check the fetched document for a <link> tag
    const icon_url_string = await favicon_search_document(conn, url_object,
      urls, response);
    if(icon_url_string)
      return icon_url_string;
  }

  // Step 4: check the cache for the origin url
  if(conn && !urls.has(url_object.origin)) {
    const icon_url_string = await favicon_db_find_origin_url(conn,
      url_object.origin, urls, max_age_ms);
    if(icon_url_string)
      return icon_url_string;
  }

  // Step 5: check for /favicon.ico
  const icon_url_string = await favicon_lookup_origin(conn, url_object, urls,
    fetch_img_timeout_ms, min_img_size, max_img_size);
  return icon_url_string;
}

async function favicon_db_find_lookup_url(conn, url_object, max_age_ms) {
  const entry = await favicon_db_find_entry(conn, url_object);
  if(!entry)
    return;
  const current_date = new Date();
  if(favicon_is_entry_expired(entry, current_date, max_age_ms))
    return;
  if(FAVICON_DEBUG)
    DEBUG('found favicon of input url in cache', entry);
  return entry.iconURLString;
}

async function favicon_db_find_redirect_url(conn, url_object, response,
  max_age_ms) {
  const response_url_object = new URL(response.response_url);
  const entry = await favicon_db_find_entry(conn, response_url_object);
  if(!entry)
    return;
  const current_date = new Date();
  if(favicon_is_entry_expired(entry, current_date, max_age_ms))
    return;
  if(FAVICON_DEBUG)
    DEBUG('found redirect in cache', entry);
  const entries = [url_object.href];
  await favicon_db_put_entries(conn, entry.iconURLString, entries);
  return entry.iconURLString;
}

// @returns {String} a favicon url
async function favicon_search_document(conn, url_object, urls, response) {
  let text;
  try {
    text = await response.text();
  } catch(error) {
    if(FAVICON_DEBUG)
      DEBUG(error);
    return;
  }

  const [status, document] = html_parse_from_string(text);
  if(status !== STATUS_OK)
    return;

  if(!document.head)
    return;

  const base_url_object = response.redirected ?
    new URL(response.response_url) : url_object;

  let icon_url_object;
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

  // TODO: querySelectorAll?

  for(let selector of selectors) {
    const element = document.head.querySelector(selector);
    if(!element)
      continue;

    // Avoid passing empty string to URL constructor
    let hrefString = element.getAttribute('href');
    if(!hrefString)
      continue;

    hrefString = hrefString.trim();
    if(!hrefString)
      continue;

    try {
      icon_url_object = new URL(hrefString, base_url_object);
    } catch(error) {
      continue;
    }

    if(FAVICON_DEBUG) {
      DEBUG('Found favicon from <link>', response.response_url,
        icon_url_object.href);
    }

    if(conn)
      await favicon_db_put_entries(conn, icon_url_object.href, urls);
    return icon_url_object.href;
  }
}

async function favicon_db_find_origin_url(conn, origin_url_string, urls,
  max_age_ms) {
  const origin_url_object = new URL(origin_url_string);
  const origin_entry = await favicon_db_find_entry(conn, origin_url_object);
  const current_date = new Date();
  if(!origin_entry)
    return;
  if(favicon_is_entry_expired(origin_entry, current_date, max_age_ms))
    return;

  if(FAVICON_DEBUG) {
    DEBUG('Found non-expired origin entry in cache', origin_url_string,
      origin_entry.iconURLString);
  }

  // origin is not in urls, and we know it is distinct, existing, and fresh
  await favicon_db_put_entries(conn, origin_entry.iconURLString, urls);
  return origin_entry.iconURLString;
}

async function favicon_lookup_origin(conn, url_object, urls,
  fetch_img_timeout_ms, min_img_size, max_img_size) {
  const img_url_string = url_object.origin + '/favicon.ico';
  const fetch_promise = fetch_image_head(img_url_string,
    fetch_img_timeout_ms);
  let response;
  try {
    response = await fetch_promise;
  } catch(error) {
    if(FAVICON_DEBUG)
      DEBUG(error);
    return;
  }

  if(response.size === FETCH_UNKNOWN_CONTENT_LENGTH ||
    (response.size >= min_img_size && response.size <= max_img_size)) {
    if(conn)
      await favicon_db_put_entries(conn, response.response_url, urls);
    if(FAVICON_DEBUG) {
      DEBUG('Found origin icon', url_object.href, response.response_url);
    }
    return response.response_url;
  }
}

// TODO: inline
async function favicon_fetch_doc_silently(url_object, fetch_html_timeout_ms) {
  const fetch_promise = fetch_html(url_object.href,
    fetch_html_timeout_ms);
  try {
    return await fetch_promise;
  } catch(error) {
    if(FAVICON_DEBUG) {
      DEBUG(error);
    }
  }
}

async function favicon_setup_db(name, version, timeout_ms) {
  let conn;
  try {
    conn = await favicon_open_db(name, version, timeout_ms);
  } finally {
    if(conn)
      conn.close();
  }
}

// @param name {String} optional, indexedDB database name
// @param version {Number} optional, indexedDB database version
// @param timeout_ms {Number} optional, maximum amount of time to wait when
// connecting to indexedDB before failure
// @throws {TypeError} invalid timeout (any other errors occur within promise)
// @returns {Promise} resolves to open IDBDatabase instance
async function favicon_open_db(name, version, timeout_ms) {
  if(typeof name === 'undefined')
    name = 'favicon-cache';
  if(typeof version === 'undefined')
    version = 2;
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 100;

  // In the case of a connection blocked event, eventually timeout
  const connect_promise = favicon_create_open_db_promise(name, version);
  const error_message = 'Connecting to indexedDB database ' + name +
    ' timed out.';
  const timeout_promise = favicon_reject_after_timeout(timeout_ms,
    error_message);
  const promises = [connect_promise, timeout_promise];
  return await Promise.race(promises);
}

function favicon_create_open_db_promise(name, version) {
  return new Promise(function executor(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon_db_onupgradeneeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
}

function favicon_db_onupgradeneeded(event) {
  const conn = event.target.result;
  if(FAVICON_DEBUG)
    DEBUG('creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    if(FAVICON_DEBUG)
      DEBUG('Creating favicon-cache object store');

    store = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    if(FAVICON_DEBUG)
      DEBUG('Creating dateUpdated index');
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
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function favicon_db_find_entry(conn, url_object) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(url_object.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function favicon_db_find_expired_entries(conn, max_age_ms) {
  if(typeof max_age_ms === 'undefined')
    max_age_ms = FAVICON_DEFAULT_MAX_AGE_MS;

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
async function favicon_compact_db(conn, max_age_ms) {
  const expired_entries = await favicon_db_find_expired_entries(conn,
    max_age_ms);
  const urls = [];
  for(const entry of expired_entries)
    urls.push(entry.pageURLString);
  const resolutions = await favicon_db_remove_entries_with_urls(conn, urls);
  return resolutions.length;
}

// TODO: this should probably be inlined into the open_db function, so that
// I can do things easily like get the timer id and call cancelTimeout
function favicon_reject_after_timeout(timeout_ms, error_message) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 4;
  // TODO: document the actual minimum
  // TODO: this probably doesn't need to be an assert. Just a comment near
  // the call to setTimeout that the browser may adjust it
  // Per MDN and Google, the minimum is 4ms.
  ASSERT(timeout_ms > 3);

  return new Promise(function(resolve, reject) {
    const error = new Error(error_message);
    setTimeout(reject, timeout_ms, error);
  });
}
