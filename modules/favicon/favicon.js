// See license.md

'use strict';

// Favicon service module.
// Requires utils.js

const favicon = {};

favicon.db_name = 'favicon-cache';
favicon.db_version = 1;
favicon.max_age = 1000 * 60 * 60 * 24 * 30;
favicon.console = {
  'debug': function() {},
  'log': function(){}
};

// Icon byte size limits
favicon.min_size = 49;
favicon.max_size = 10 * 1024 + 1;

// Given a url, lookup the associated favicon url. Tries to follow the spec by
// first checking for the icon in the page, then checking in the domain root.
// @param conn {IDBDatabase}
// @param url {URL}
// @param log {console}
// @returns {Promise} a promise that resolves to the icon url string or
// undefined
favicon.lookup = async function(conn, url, log = favicon.console) {
  log.log('LOOKUP', url.href);
  const uniq_urls = [url.href];
  const current_date = new Date();
  const selectors = [
    'link[rel="icon"][href]',
    'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ];

  // Lookup the url in the cache
  const entry = await favicon.find(conn, url.href, log);
  if(entry && !favicon.is_expired(entry, current_date))
    return entry.iconURLString;

  // Check if we are online in order to fetch.
  // This helps distinguish network errors from 404s.
  if('onLine' in navigator && !navigator.onLine)
    return;

  // Fetch the html of the url
  let doc, response_url;
  // TODO: make this a parameter
  const fetch_html_timeout = 500;
  try {
    [doc, response_url] =
      await favicon.fetch_doc(url.href, fetch_html_timeout, log);
  } catch(error) {
    // This error should not cause the lookup to implicitly reject
  }

  // If redirected, track the redirected url
  if(response_url) {
    response_url = new URL(response_url);
    if(response_url.href !== url.href)
      uniq_urls.push(response_url.href);
  }

  // If the fetch failed but we have an entry, remove it because it is no
  // longer valid
  if(entry && !doc) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    await favicon.remove(tx, url.href, log);
  }

  // If the document is valid, then search for links in the head, and
  // ensure the links are absolute. Use the first valid link found.
  // TODO: use a single querySelectorAll?
  let doc_icon_url;
  let base_url = response_url ? response_url : url;
  if(doc && doc.documentElement.localName === 'html' && doc.head) {
    for(let selector of selectors) {
      doc_icon_url = favicon.match(doc.head, selector, base_url);
      if(doc_icon_url)
        break;
    }
  }

  // If we found an in page icon, update the cache and resolve
  // TODO: can also store origin in cache if it distinct? would need to move
  // some origin url code upward
  if(doc_icon_url) {
    log.debug('Found favicon <link>', url.href, doc_icon_url.href);
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const proms = uniq_urls.map((url) => favicon.add(tx, url,
      doc_icon_url.href, log));
    await Promise.all(proms);
    return doc_icon_url.href;
  }

  // If redirected to different url, check cache for redirect
  let redirect_entry;
  if(uniq_urls.length > 1) {
    redirect_entry = await favicon.find(conn, response_url.href, log);
  }

  // If the redirect url is in the cache, then resolve with that
  if(redirect_entry && !favicon.is_expired(redirect_entry, current_date)) {
    return redirect_entry.iconURLString;
  }

  // Next, try checking if the origin url is in the cache if it is different
  let origin_entry;
  if(!uniq_urls.includes(url.origin)) {
    uniq_urls.push(url.origin);
    origin_entry = await favicon.find(conn, url.origin, log);
  }

  // If we found an origin entry, resolve with that
  if(origin_entry && !favicon.is_expired(origin_entry, current_date)) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    // Do not re-add the origin entry
    let proms = uniq_urls.filter((url)=> url !== url.origin);
    // Do add the url and possible redirect url, because those failed
    proms = proms.map((url) => favicon.add(tx, url,
      origin_entry.iconURLString, log));
    await Promise.all(proms);
    return origin_entry.iconURLString;
  }

  // Nothing is in the icon cache, and could not find in page. Fall back to
  // checking for image in domain root
  const fetch_image_timeout = 100;
  let image_size, image_response_url;
  try {
    // TODO: use object destructuring instead of array
    [image_size, image_response_url] =
      await favicon.request_image_head(url.origin + '/favicon.ico',
        fetch_image_timeout, log);
  } catch(error) {
    log.warn(error);// Non-fatal
  }

  const size_in_range = image_size === -1 || (image_size > favicon.min_size &&
    image_size < favicon.max_size);

  // If fetched and size is in range, then resolve to it
  if(image_response_url && size_in_range) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    // Map the icon to the distinct urls in the cache
    const proms = uniq_urls.map((url) => favicon.add(tx, url,
      image_response_url, log));
    await Promise.all(proms);
    return image_response_url;
  }

  // Remove expired entries
  const expired_urls = [];
  if(entry)
    expired_urls.push(entry.pageURLString);
  if(redirect_entry)
    expired_urls.push(redirect_entry.pageURLString);
  if(origin_entry)
    expired_urls.push(origin_entry.pageURLString);
  if(expired_urls.length) {
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const proms = expired_urls.map((url) => favicon.remove(tx, url, log));
    await Promise.all(proms);
  }

  // Failed to find favicon. Return undefined
};

// Connect to the favicon cache database. If name or version are not provided
// then the default name and version are used.
// @param name {String} database name
// @param version {int} version number
// @param log {console} optional log
favicon.connect = function(name = favicon.db_name, version = favicon.db_version,
  log = favicon.console) {
  return new Promise(function(resolve, reject) {
    log.log('Connecting to database', name, 'version', version);
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon._upgrade.bind(request, log);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      log.debug('Connected to database', conn.name);
      resolve(conn);
    };
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
};

// Private helper that installs or upgrades the database
favicon._upgrade = function(log, event) {
  const conn = event.target.result;
  log.log('Creating or upgrading database', conn.name);
  if(!conn.objectStoreNames.contains('favicon-cache')) {
    conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
};

// Returns true if the age of the entry is greater than the maximum age
favicon.is_expired = function(entry, current_date, max_age = favicon.max_age) {
  const age = current_date - entry.dateUpdated;
  return age > max_age;
};

// Searches for a cached entry in the favicon database
// @param conn {IDBDatabase}
// @param url {String}
// @param log {console}
favicon.find = function(conn, url, log) {
  return new Promise(function(resolve, reject) {
    log.log('Searching for entry', url);
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(url);
    request.onsuccess = function onsuccess(event) {
      const entry = event.target.result;
      if(entry)
        log.debug('Favicon cache hit', url, entry.iconURLString);
      resolve(entry);
    };
    request.onerror = function onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
};

// Adds or replaces an entry in the favicon cache database
// @param tx {IDBTransaction}
// @param page_url {String}
// @param icon_url {String}
// @param log {console}
favicon.add = function(tx, page_url, icon_url, log) {
  return new Promise(function(resolve, reject) {
    const entry = {'pageURLString': page_url, 'iconURLString': icon_url,
      'dateUpdated': new Date()};
    log.debug('Adding favicon entry', entry.pageURLString);
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
};

// Removes an entry from the cache database
// @param tx {IDBTransaction}
// @param page_url {String}
// @param log {console}
favicon.remove = function(tx, page_url, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Removing favicon entry', page_url);
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(page_url);
    request.onsuccess = function onsuccess(event) {
      resolve();
    };
    request.onerror = function onerror(event) {
      reject(event.target.error);
    };
  });
};

// Looks for a <link> tag within an ancestor element
// @param ancestor {Element}
// @param selector {String}
// @param base_url {URL}
favicon.match = function(ancestor, selector, base_url) {
  const element = ancestor.querySelector(selector);
  if(!element)
    return;
  const href = (element.getAttribute('href') || '').trim();
  // Without this check the URL constructor would not throw
  if(!href)
    return;
  try {
    return new URL(href, base_url);
  } catch(error) {
  }
};

// Fetches the html of the given url
// @param url {String}
// @param log {console}
// TODO: maybe I can avoid parsing and just search raw text for
// <link> tags, the accuracy loss may be ok given the speed boost
// TODO: use streaming text api, stop reading on </head>
favicon.fetch_doc = async function(url, timeout = 0, log) {
  log.debug('Fetching', url);
  const opts = {};
  opts.credentials = 'omit';
  opts.method = 'GET';
  opts.headers = {'Accept': 'text/html'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  const promises = [fetch(url, opts)];
  if(timeout)
    promises.push(fetch_timeout(timeout));
  const response = await Promise.race(promises);

  if(!response.ok)
    throw new Error(response.status);
  if(response.status === 204)
    throw new Error(response.status);

  const type = response.headers.get('Content-Type');
  if(!/^\s*text\/html/i.test(type))
    throw new Error(`Invalid response type ${type} for ${url}`);
  const text = await response.text();
  const parser = new DOMParser();
  const doc = parser.parseFromString(text, 'text/html');
  if(doc.documentElement.localName !== 'html')
    throw new Error('Invalid html');
  log.debug('Fetched html document', url, text.length);
  return [doc, response.url];
};

// Sends a HEAD request for the given image. Ignores response body.
// @param image_url {String}
// @param log {console}
// @returns {Promise}
favicon.request_image_head = async function(url, timeout, log) {
  log.debug('HEAD', url);
  const opts = {};
  opts.credentials = 'omit'; // No cookies
  opts.method = 'HEAD';
  // Based on Chrome's native headers
  opts.headers = {'accept': 'image/webp,image/*,*/*;q=0.8'};
  opts.mode = 'cors';
  opts.cache = 'default';
  opts.redirect = 'follow';
  opts.referrer = 'no-referrer';

  // Race a timeout with the fetch
  const promises = [fetch(url, opts)];
  if(timeout)
    promises.push(fetch_timeout(timeout));
  const response = await Promise.race(promises);

  // Treat non-network errors as fatal errors
  // Ignore 204 No content, it is irrelevant for HEAD
  if(!response.ok)
    throw new Error(`${response.status} ${response.statusText} ${url}`);

  // Treat invalid content type as error
  // Treat unknown content type as valid
  // TODO: maybe be more restrictive about allowed content type

  // image/vnd.microsoft.icon
  // image/png
  // image/x-icon
  // image/webp

  const content_type = response.headers.get('Content-Type');
  log.debug('Content-Type', content_type, url);
  if(content_type && !/^\s*image\//i.test(content_type))
    throw new Error(`Invalid response type ${content_type}`);

  // Content-Length appears to be undefined for 304 or served from cache
  const content_length = response.headers.get('Content-Length');
  log.debug('Content-Length', content_length);

  let content_length_int = -1;
  if(content_length) {
    try {
      content_length_int = parseInt(content_length, 10);
    } catch(error) {
    }
  }

  return [content_length_int, response.url];
};

// Deletes expired entries from the favicon cache database
// @param conn {IDBDatabase}
// @param log {console}
// TODO: query for only expired entries rather than filter in memory
favicon.compact = async function(conn, log = favicon.console) {
  log.log('Compacting favicons in database', conn.name);
  const current_date = new Date();
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const entries = await favicon.get_all(tx, log);
  const expired_entries = entries.filter((entry) =>
    favicon.is_expired(entry, current_date));
  const proms = expired_entries.map((entry) =>
    favicon.remove(tx, entry.pageURLString, log));
  const resolutions = await Promise.all(proms);
  log.debug('Deleted %d favicon entries', expired_entries.length);
  return expired_entries.length;
};

// Using the provided transaction, returns a promise that resolves to an array
// of all favicon entries in the database
// @param tx {IDBTransaction}
// @param log {console}
favicon.get_all = function(tx, log) {
  return new Promise(function get_all_impl(resolve, reject) {
    log.debug('Getting all favicon entries from database', tx.db.name);
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = function onsuccess(event) {
      const entries = event.target.result || [];
      log.debug('Got %d entries from database %s', entries.length, tx.db.name);
      resolve(entries);
    };
    request.onerror = function onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
};
