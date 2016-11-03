// See license.md

'use strict';

// Favicon service module. No dependencies
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
favicon.max_size = 10001;

// Given a url, lookup the associated favicon url. Tries to follow the spec by
// first checking for the icon in the page, then checking in the domain root.
// @param conn {IDBDatabase}
// @param url {URL}
// @param log {console}
// @returns {Promise} a promise that resolves to the icon url string or
// undefined
favicon.lookup = function(conn, url, log = favicon.console) {
  return new Promise(async function lookup_impl(resolve, reject) {
    log.log('Looking up favicon for url', url.href);

    const uniq_urls = [url.href];

    // Lookup the url in the cache
    let entry;
    try {
      entry = await favicon.find(conn, url.href, log);
    } catch(error) {
      reject(error);
      return;
    }

    // If the url is in the cache, and has not expired, then resolve to it
    const current_date = new Date();
    if(entry && !favicon.is_expired(entry, current_date)) {
      resolve(entry.iconURLString);
      return;
    }

    // Check if we are online in order to fetch. If not, there is nothing to do.
    // This aids in distinguishing from certain fetch errors.
    if('onLine' in navigator && !navigator.onLine) {
      resolve();
      return;
    }

    // Fetch the html of the url
    let doc, response_url;
    try {
      [doc, response_url] = await favicon.fetch_doc(url.href, log);
    } catch(error) {
    }

    // If the fetch redirected, keep track of the redirected url too
    if(response_url) {
      response_url = new URL(response_url);
      if(response_url.href !== url.href)
        uniq_urls.push(response_url.href);
    }

    // If the fetch failed but we have an entry, remove it because it is no
    // longer valid
    if(entry && !doc) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      try {
        await favicon.remove(tx, url.href, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    const selectors = [
      'link[rel="icon"][href]',
      'link[rel="shortcut icon"][href]',
      'link[rel="apple-touch-icon"][href]',
      'link[rel="apple-touch-icon-precomposed"][href]'
    ];

    // If the document is valid, then search for links in the head, and
    // ensure the links are absolute. Use the first valid link found.
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
      try {
        const proms = uniq_urls.map((url) => favicon.add(tx, url,
          doc_icon_url.href, log));
        await Promise.all(proms);
      } catch(error) {
        reject(error);
        return;
      }

      resolve(doc_icon_url.href);
      return;
    }

    // If redirected to different url, check cache for redirect
    let redirect_entry;
    if(uniq_urls.length > 1) {
      try {
        redirect_entry = await favicon.find(conn, response_url.href, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    // If the redirect url is in the cache, then resolve with that
    if(redirect_entry && !favicon.is_expired(redirect_entry, current_date)) {
      resolve(redirect_entry.iconURLString);
      return;
    }

    // Next, try checking if the origin url is in the cache if it is different
    let origin_entry;
    if(!uniq_urls.includes(url.origin)) {
      uniq_urls.push(url.origin);
      try {
        origin_entry = await favicon.find(conn, url.origin, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    // If we found an origin entry, resolve with that
    if(origin_entry && !favicon.is_expired(origin_entry, current_date)) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      try {
        // Do not re-add the origin entry
        let proms = uniq_urls.filter((url)=> url !== url.origin);
        // Do add the url and possible redirect url, because those failed
        proms = proms.map((url) => favicon.add(tx, url,
          origin_entry.iconURLString, log));
        await Promise.all(proms);
      } catch(error) {
        reject(error);
        return;
      }
      resolve(origin_entry.iconURLString);
      return;
    }

    // Nothing is in the icon cache, and could not find in page. Fall back to
    // checking for image in domain root
    let image_size, image_response_url;
    try {
      [image_size, image_response_url] = await favicon.fetch_image(
        url.origin + '/favicon.ico', log);
    } catch(error) {
    }

    // If the fetch did not error, and the icon is in range, then resolve to it
    if(image_response_url && image_size > favicon.min_size &&
      image_size < favicon.max_size) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      const proms = [];
      try {
        // Map the icon to the distinct urls in the cache
        const proms = uniq_urls.map((url) => favicon.add(tx, url,
          image_response_url, log));
        await Promise.all(proms);
        resolve(image_response_url);
        return;
      } catch(error) {
        reject(error);
        return;
      }
    }

    // Remove any expired entries from the cache
    const expired_urls = [];
    if(entry)
      expired_urls.push(entry.pageURLString);
    if(redirect_entry)
      expired_urls.push(redirect_entry.pageURLString);
    if(origin_entry)
      expired_urls.push(origin_entry.pageURLString);

    if(expired_urls.length) {
      try {
        const tx = conn.transaction('favicon-cache', 'readwrite');
        const proms = expired_urls.map((url) =>
          favicon.remove(tx, url, log));
        await Promise.all(proms);
      } catch(error) {
        reject(error);
        return;
      }
    }

    // Failed to find favicon
    resolve();
  });
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
    request.onerror = function(event) {
      reject(event.target.error);
    };
    request.onblocked = function(event) {
      console.warn('favicon.connect waiting indefinitely while blocked');
    };
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
    log.log('Checking favicon cache for page url', url);
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
    log.debug('Adding favicon entry for', entry.pageURLString);
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = function onsuccess(event) { resolve(); };
    request.onerror = function onerror(event) { reject(event.target.error); };
  });
};

// Removes an entry from the cache database
// @param tx {IDBTransaction}
// @param page_url {String}
// @param log {console-like}
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

// Looks for a <link> tag within the document
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
// TODO: use streaming text api, stop reading on includes('</head>')
favicon.fetch_doc = function(url, log) {
  return new Promise(async function(resolve, reject) {
    log.debug('Fetching', url);
    const opts = {};
    opts.credentials = 'omit';
    opts.method = 'GET';
    opts.headers = {'Accept': 'text/html'};
    opts.mode = 'cors';
    opts.cache = 'default';
    opts.redirect = 'follow';
    opts.referrer = 'no-referrer';
    let response;
    try {
      response = await fetch(url, opts);
    } catch(error) {
      reject(error);
      return;
    }

    if(!response.ok) {
      reject(new Error(response.status));
      return;
    }

    let type = response.headers.get('Content-Type');
    if(!/^\s*text\/html/i.test(type)) {
      reject(new Error(`Invalid response type ${type} for ${url}`));
      return;
    }

    let text;
    try {
      text = await response.text();
    } catch(error) {
      reject(error);
      return;
    }

    const parser = new DOMParser();
    let doc;
    try {
      doc = parser.parseFromString(text, 'text/html');
    } catch(error) {
      reject(error);
      return;
    }

    if(!doc.documentElement || doc.documentElement.localName !== 'html') {
      reject(new Error('Invalid html'));
      return;
    }
    log.debug('Fetched html document', url, text.length);
    resolve([doc, response.url]);
  });
};

// Sends a HEAD request for the given image
// @param image_url {String}
// @param log {console}
// @returns {Promise}
// TODO: set proper Accept header
favicon.fetch_image = function(image_url, log) {
  return new Promise(async function(resolve, reject) {
    log.debug('Fetching', image_url);
    const opts = {};
    opts.credentials = 'omit';
    opts.method = 'HEAD';
    //opts.headers = {'Accept': ''};
    opts.mode = 'cors';
    opts.cache = 'default';
    opts.redirect = 'follow';
    opts.referrer = 'no-referrer';

    let response;
    try {
      response = await fetch(image_url, opts);
    } catch(error) {
      reject(error);
      return;
    }

    if(!response.ok) {
      reject(new Error(response.status + ' ' + response.statusText));
      return;
    }

    const type = response.headers.get('Content-Type');
    if(!/^\s*image\//i.test(type)) {
      reject(new Error(`Invalid response type ${type}`));
      return;
    }

    let size = 0;
    try {
      size = parseInt(response.headers.get('Content-Length'), 10);
    } catch(error) {
    }

    resolve([size, response.url]);
  });
};

// Deletes expired entries from the favicon cache database
// @param conn {IDBDatabase}
// @param log {console}
favicon.compact = function(conn, log = favicon.console) {
  return new Promise(async function compact_impl(resolve, reject) {
    log.log('Compacting favicons in database', conn.name);

    // Create a single transaction to share among all requests
    const tx = conn.transaction('favicon-cache', 'readwrite');

    // Load an array of all entries in the database
    let entries;
    try {
      entries = await favicon.get_all(tx, log);
    } catch(error) {
      reject(error);
      return;
    }

    // Get a subset of expired entries. Use the the call time of this
    // function, for determining whether an entry is expired
    const current_date = new Date();
    const expired_entries = entries.filter((entry) =>
      favicon.is_expired(entry, current_date));

    log.debug('Found %d expired entries', expired_entries.length);

    // Issue individual remove entry requests concurrently, and store the
    // remove promises in an array
    let remove_promises, resolutions;
    try {
      remove_promises = expired_entries.map((entry) =>
        favicon.remove(tx, entry.pageURLString, log));
      resolutions = await Promise.all(remove_promises);
    } catch(error) {
      reject(error);
      return;
    }

    log.debug('Deleted %d favicon entries', resolutions.length);
    resolve(resolutions.length);
  });
};

// Using the provided transaction, returns a promise that resolves to an array
// of all favicon entries in the database
// @param tx {IDBTransaction}
// @param log {console}
favicon.get_all = function(tx, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Getting all favicon entries from database', tx.db.name);
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = function(event) {
      const entries = event.target.result || [];
      log.debug('Got %d entries from database %s', entries.length, tx.db.name);
      resolve(entries);
    };
    request.onerror = function(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
};
