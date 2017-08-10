// See license.md
'use strict';

{ // Begin file block scope

// 30 days in ms, used by both lookup and compact
const default_max_age_ms = 1000 * 60 * 60 * 24 * 30;

const IMG_SIZE_UNKNOWN = -1;

// Looks up the favicon url for a given web page url
// @returns {String} the favicon url if found, otherwise undefined
async function favicon_lookup(conn, url_object, max_age_ms,
  fetch_html_timeout_ms, fetch_img_timeout_ms, min_img_size, max_img_size,
  verbose) {
  if(verbose)
    console.log('Starting favicon_lookup for url', url_object.href);
  if(typeof max_age_ms === 'undefined')
    max_age_ms = default_max_age_ms;
  if(typeof fetch_html_timeout_ms === 'undefined')
    fetch_html_timeout_ms = 1000;
  if(typeof fetch_img_timeout_ms === 'undefined')
    fetch_img_timeout_ms = 200;
  if(typeof min_img_size === 'undefined')
    min_img_size = 50;
  if(typeof max_img_size === 'undefined')
    max_img_size = 10240;

  // TODO: maybe this is always overkill and not needed
  const urls = new Set();
  urls.add(url_object.href);

  // Step 1: check the cache for the input url
  if(conn) {
    const icon_url_string = await db_find_lookup_url(conn, url_object,
      max_age_ms, verbose);
    if(icon_url_string)
      return icon_url_string;
  }

  const response = await fetch_doc_silently(url_object, fetch_html_timeout_ms,
    verbose);
  if(response) {
    // Step 2: check the cache for the redirect url
    if(conn && response.redirected) {
      const response_url_object = new URL(response.response_url_string);
      urls.add(response_url_object.href);
      const icon_url_string = await db_find_redirect_url(conn, url_object,
        response, max_age_ms, verbose);
      if(icon_url_string)
        return icon_url_string;
    }

    // Step 3: check the fetched document for a <link> tag
    const icon_url_string = await search_document(conn, url_object, urls,
      response, verbose);
    if(icon_url_string)
      return icon_url_string;
  }

  // Step 4: check the cache for the origin url
  if(conn && !urls.has(url_object.origin)) {
    const icon_url_string = await db_find_origin_url(conn, url_object.origin,
      urls, max_age_ms, verbose);
    if(icon_url_string)
      return icon_url_string;
  }

  // Step 5: check for /favicon.ico
  const icon_url_string = await lookup_origin(conn, url_object, urls,
    fetch_img_timeout_ms, min_img_size, max_img_size, verbose);
  return icon_url_string;
}

async function db_find_lookup_url(conn, url_object, max_age_ms, verbose) {
  const entry = await db_find_entry(conn, url_object);
  if(!entry)
    return;
  const current_date = new Date();
  if(is_entry_expired(entry, current_date, max_age_ms))
    return;
  if(verbose)
    console.log('Found favicon of input url in cache', entry);
  return entry.iconURLString;
}

async function db_find_redirect_url(conn, url_object, response, max_age_ms,
  verbose) {
  const response_url_object = new URL(response.response_url_string);
  const entry = await db_find_entry(conn, response_url_object);
  if(!entry)
    return;
  const current_date = new Date();
  if(is_entry_expired(entry, current_date, max_age_ms))
    return;
  if(verbose)
    console.debug('Found redirect in cache', entry);
  const entries = [url_object.href];
  await db_put_entries(conn, entry.iconURLString, entries);
  return entry.iconURLString;
}

// @returns {String} a favicon url
async function search_document(conn, url_object, urls, response, verbose) {
  let document;
  try {
    const text = await response.text();
    document = parse_html(text);
  } catch(error) {
    if(verbose)
      console.warn(error);
    return;
  }

  if(!document.head)
    return;

  const base_url_object = response.redirected ?
    new URL(response.response_url_string) : url_object;

  let icon_url_object;
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

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
    if(verbose)
      console.debug('Found favicon from <link>', response.response_url_string,
        icon_url_object.href);
    if(conn)
      await db_put_entries(conn, icon_url_object.href, urls);
    return icon_url_object.href;
  }
}

async function db_find_origin_url(conn, origin_url_string, urls, max_age_ms, verbose) {
  const origin_url_object = new URL(origin_url_string);
  const origin_entry = await db_find_entry(conn, origin_url_object);
  const current_date = new Date();
  if(!origin_entry)
    return;
  if(is_entry_expired(origin_entry, current_date, max_age_ms))
    return;
  if(verbose)
    console.debug('Found non-expired origin entry in cache', origin_url_string,
      origin_entry.iconURLString);
  // origin is not in urls, and we know it is distinct, existing, and fresh
  await db_put_entries(conn, origin_entry.iconURLString, urls);
  return origin_entry.iconURLString;
}



async function lookup_origin(conn, url_object, urls, fetch_img_timeout_ms,
  min_img_size, max_img_size, verbose) {
  const img_url_string = url_object.origin + '/favicon.ico';
  const fetch_promise = send_img_head_request(img_url_string,
    fetch_img_timeout_ms, verbose);
  let response;
  try {
    response = await fetch_promise;
  } catch(error) {
    if(verbose)
      console.debug(error);
    return;
  }

  if(response.size === IMG_SIZE_UNKNOWN || (response.size >= min_img_size &&
      response.size <= max_img_size)) {
    if(conn)
      await db_put_entries(conn, response.response_url_string, urls);
    if(verbose)
      console.debug('Found origin icon', url_object.href,
        response.response_url_string);
    return response.response_url_string;
  }
}

async function fetch_doc_silently(url_object, fetch_html_timeout_ms, verbose) {
  const fetch_promise = fetch_doc(url_object.href, fetch_html_timeout_ms);
  try {
    return await fetch_promise;
  } catch(error) {
    if(verbose)
      console.log(error);
  }
}

async function favicon_setup_db(name, version, verbose) {
  // TODO: timeout_ms should be param
  let conn, timeout_ms;
  try {
    conn = await favicon_open_db(name, version, timeout_ms, verbose);
  } finally {
    if(conn)
      conn.close();
  }
}

// @param name {String} optional, indexedDB database name
// @param version {Number} optional, indexedDB database version
// @param timeout_ms {Number} optional, maximum amount of time to wait when
// connecting to indexedDB before failure
// @param verbose {Boolean} optional, whether to log messages to console
// @throws {TypeError} invalid timeout (any other errors occur within promise)
// @returns {Promise} resolves to open IDBDatabase instance
async function favicon_open_db(name, version, timeout_ms, verbose) {
  if(typeof name === 'undefined')
    name = 'favicon-cache';
  if(typeof version === 'undefined')
    version = 2;
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 100;

  // In the case of a connection blocked event, eventually timeout
  const connect_promise = favicon_open_db_internal(name, version, verbose);
  const error_message = 'Connecting to indexedDB database ' + name +
    ' timed out.';
  const timeout_promise = reject_after_timeout(timeout_ms, error_message);
  const promises = [connect_promise, timeout_promise];
  return await Promise.race(promises);
}

function favicon_open_db_internal(name, version, verbose) {
  function resolver(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon_db_upgrade.bind(request, verbose);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  }
  return new Promise(resolver);
}

function favicon_db_upgrade(verbose, event) {
  const conn = event.target.result;
  if(verbose)
    console.log('Creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    if(verbose)
      console.log('Creating favicon-cache object store');
    store = conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    if(verbose)
      console.log('Creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }
}

// An entry is expired if the difference between today's date and the date the
// entry was last updated is greater than max age.
// TODO: maybe new Date() is not much of an optimization so current_date does
// not need to be a param and instead create it locally per call
function is_entry_expired(entry, current_date, max_age_ms) {
  // Subtracting a date from another date yields a difference in ms
  const entry_age_ms = current_date - entry.dateUpdated;
  return entry_age_ms > max_age_ms;
}

function favicon_clear_db(conn) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

async function find_unexpired_entry(conn, url_object, max_age_ms) {
  throw new Error('Unimplemented');
}

function db_find_entry(conn, url_object) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(url_object.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }
  return new Promise(resolver);
}

function db_find_expired_entries(conn, max_age_ms) {
  function resolver(resolve, reject) {
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
  }
  return new Promise(resolver);
}

function db_remove_entries_with_urls(conn, page_urls) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of page_urls)
      store.delete(url);
  }
  return new Promise(resolver);
}

function db_put_entries(conn, icon_url_string, page_urls) {
  function resolver(resolve, reject) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    const current_date = new Date();
    for(const url_string of page_urls) {
      const entry = {};
      entry.pageURLString = url_string;
      entry.iconURLString = icon_url_string;
      entry.dateUpdated = current_date;
      store.put(entry);
    }
  }
  return new Promise(resolver);
}

// Finds all expired entries in the database and removes them
async function favicon_compact_db(name, version, max_age_ms, verbose) {
  if(typeof max_age_ms === 'undefined')
    max_age_ms = default_max_age_ms;

  let conn_timeout_ms, conn;
  try {
    conn = await favicon_open_db(name, version, conn_timeout_ms, verbose);
    const expired_entries = await db_find_expired_entries(conn, max_age_ms);
    const urls = [];
    for(const entry of expired_entries) {
      urls.push(entry.pageURLString);
    }
    const resolutions = await db_remove_entries_with_urls(conn, urls);
    return resolutions.length;
  } finally {
    if(conn)
      conn.close();
  }
}

function reject_after_timeout(timeout_ms, error_message) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 4;
  // Per MDN and Google, the minimum is 4ms.
  // Throw immediately as this is a static type error.
  if(timeout_ms < 4)
    throw new TypeError('timeout_ms must be greater than 4');

  function resolver(resolve, reject) {
    const error = new Error(error_message);
    setTimeout(reject, timeout_ms, error);
  }

  return new Promise(resolver);
}

// Race a timeout against a fetch
// TODO: cancel fetch once cancelation tokens supported
async function fetch_with_timeout(url_string, options, timeout_ms) {
  if(typeof url_string !== 'string')
    throw new TypeError('Parameter url_string is not a defined string: ' +
      url_string);

  if('onLine' in navigator && !navigator.onLine)
    throw new Error('Cannot fetch url while offline ' + url_string);

  const fetch_promise = fetch(url_string, options);
  let response;
  if(timeout_ms) {
    const error_message = 'Request timed out for url ' + url_string;
    const timeout_promise = reject_after_timeout(timeout_ms, error_message);
    const promises = [fetch_promise, timeout_promise];
    response = await Promise.race(promises);
  } else
    response = await fetch_promise;

  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url_string}`);
  return response;
}

async function fetch_doc(url_string, timeout_ms) {
  const headers = {'Accept': 'text/html'};
  const options = {};
  options.credentials = 'omit';
  options.method = 'get';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';
  options.referrerPolicy = 'no-referrer';
  const response = await fetch_with_timeout(url_string, options, timeout_ms);
  assert_response_has_content(response, url_string);
  assert_response_is_html(response, url_string);
  const output_response = {};
  output_response.text = async function() {
    return await response.text();
  };
  output_response.response_url_string = response.url;
  output_response.redirected = detect_redirect(url_string, response.url);
  return output_response;
}

function detect_redirect(request_url_string, response_url_string) {
  // A redirected url is never the same as the request url. Regardless of
  // what happens in the underlying opaque request, or whatever
  // Response.prototype.redirected is
  if(request_url_string === response_url_string)
    return false;
  const request_url_object = new URL(request_url_string);
  const response_url_object = new URL(response_url_string);
  request_url_object.hash = '';
  response_url_object.hash = '';
  return request_url_object.href !== response_url_object.href;
}

function parse_html(html_string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html_string, 'text/html');
  const errors = doc.getElementsByTagName('parsererror');
  if(errors && errors.length)
    throw new Error('Embedded html parser error: ' + errors[0].textContent);
  const rootName = doc.documentElement.localName.toLowerCase();
  if(rootName !== 'html')
    throw new Error(`Document element is not <html>: ${rootName}`);
  return doc;
}

// Sends a HEAD request for the given image.
// @param url_string {String}
// @returns a simple object with props imageSize and response_url_string
async function send_img_head_request(url_string, timeout_ms, verbose) {
  const headers = {'Accept': 'image/*'};
  const options = {};
  options.credentials = 'omit';
  options.method = 'HEAD';
  options.headers = headers;
  options.mode = 'cors';
  options.cache = 'default';
  options.redirect = 'follow';
  options.referrer = 'no-referrer';
  const response = await fetch_with_timeout(url_string, options, timeout_ms);
  assert_response_is_img(response);
  const output_response = {};
  output_response.size = get_response_content_length(response, verbose);
  output_response.response_url_string = response.url;
  return output_response;
}

function get_response_content_length(response, verbose) {
  const content_length_string = response.headers.get('Content-Length');
  const radix = 10;
  const content_length = parseInt(content_length_string, radix);
  return isNaN(content_length) ? IMG_SIZE_UNKNOWN : content_length;
}

// Response.ok is true for 204, but I treat 204 as error.
function assert_response_has_content(response, url_string) {
  const no_content_http_status = 204;
  if(response.status === no_content_http_status)
    throw new Error(`${response.status} ${response.statusText} ${url_string}`);
}

function assert_response_is_html(response, url_string) {
  const type_header = response.headers.get('Content-Type');
  if(!/^\s*text\/html/i.test(type_header))
    throw new Error(`Invalid content type "${type_header}" ${url_string}`);
}

function assert_response_is_img(response) {
  const type_header = response.headers.get('Content-Type');
  if(!/^\s*image\//i.test(type_header))
    throw new Error(`Invalid response type ${type_header}`);
}

// Export methods to outer (global) scope
this.favicon_lookup = favicon_lookup;
this.favicon_open_db = favicon_open_db;
this.favicon_clear_db = favicon_clear_db;
this.favicon_compact_db = favicon_compact_db;
this.favicon_setup_db = favicon_setup_db;

} // End file block scope
