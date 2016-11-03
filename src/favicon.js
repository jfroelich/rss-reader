// See license.md

'use strict';

// Mostly standalone favicon service module

// TODO: priority todo is to switch to fetch OMIT for both html and images
// TODO: validate in doc urls exists by sending a HEAD request for matches?
// TODO: research failure case, http://www.microsoft.com
// TODO: maybe use a url string instead a URL object to simplify api
// TODO: look into decoupling silent-console so that this has no deps, maybe
// accept console as input and have each debug use if(console)
// TODO: maybe favicon_lookup should accept a string and return a string, it
// simplifies things. it can still use URL internally where needed
// TODO: maybe be more restrictive than image regex about response type,
// maybe lookup in an array of allowed types, and maybe even inspect image
// data itself (but this would require non-head request).
// TODO: think more about issues with data: urls, be more cautious about this
// Food for thought: why have some of the helper functions return promises,
// when in fact these could be async calls that block until return, and just
// return the output. from the outside the functions just look like sync
// functions. for example, why not have favicon_connect just return a conn?
// why return a promise? every single call to favicon_connect awaits it,
// because there is no concern about concurrency, about calling while also
// doing other work
// TODO: store failure cases too, that way i stop trying to refetch the same
// thing repeatedly, use something like failure counter, once it reaches 10
// then delete, something like that. modify other checks to consider if matched
// failure case. if successful make sure to delete failure cases. This also
// fixes ephemeral errors (site temp offline, temp unreachable).
// TODO: maybe conn can be optional, but this time, instead of conn on
// demand, just go straight to fetch

const FAVICON_DB_NAME = 'favicon-cache';
const FAVICON_DB_VERSION = 1;
const FAVICON_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

// If fetching domain root favicon it must fall within these byte limits
const FAVICON_MIN_IMAGE_SIZE = 49;
const FAVICON_MAX_IMAGE_SIZE = 10001;

// Given a url, lookup the associated favicon url
// Regaring favicon resolution, where resolution is refering to identifying the
// associated icon for a url, this attempts to follow the whatwg standard that
// provides that a domain can have multiple favicons, prefering the icon within
// the page over a default domain wide icon. This does not bother with finding
// the best favicon though, for perf reasons.
function favicon_lookup(conn, url, log = SilentConsole) {
  return new Promise(async function lookup_impl(resolve, reject) {
    log.log('Looking up favicon for url', url.href);

    // Track an array of unique normalized url strings
    const uniq_urls = [url.href];

    // Check if the url is in the cache. Await for the cache lookup to resolve
    // because later steps depends on it.
    let entry;
    try {
      entry = await favicon_find_entry(conn, url.href, log);
    } catch(error) {
      // If there was some technical error then reject
      reject(error);
      return;
    }

    // If the entry is in the cache, and has not expired, then resolve to it
    const current_date = new Date();
    if(entry && !favicon_is_expired(entry, current_date)) {
      resolve(new URL(entry.iconURLString));
      return;
    }

    // If the entry is not in the cache, or the cache entry expired, then try to
    // fetch the resource. If we are offline, then we cannot fetch. Being
    // offline is not an error in the rejection sense.
    if('onLine' in navigator && !navigator.onLine) {
      resolve();
      return;
    }

    // Fetch the html of the url and the redirect url
    let doc, response_url;
    try {
      [doc, response_url] = await favicon_fetch_doc(url.href, log);
    } catch(error) {
    }

    if(response_url) {
      response_url = new URL(response_url);
      if(response_url.href !== url.href)
        uniq_urls.push(response_url.href);
    }

    // If the fetch failed but we have an entry, remove it
    if(entry && !doc) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      try {
        await favicon_remove_entry(tx, url.href, log);
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

    // If we fetched an html document, then search its content
    let in_doc_icon_url;
    let base_url = response_url ? response_url : url;
    if(doc && doc.documentElement.localName === 'html' && doc.head) {
      for(let selector of selectors) {
        in_doc_icon_url = favicon_match_selector(doc, selector, base_url);
        if(in_doc_icon_url)
          break;
      }
    }

    // If we found an in page icon, update the cache and resolve
    // TODO: can also store origin in cache if it distinct? would need to move
    // some origin url code upward
    if(in_doc_icon_url) {
      log.debug('Found favicon <link>', url.href, in_doc_icon_url.href);
      const tx = conn.transaction('favicon-cache', 'readwrite');
      try {
        const proms = uniq_urls.map((url) => favicon_add_entry(tx, url,
          in_doc_icon_url.href, log));
        await Promise.all(proms);
      } catch(error) {
        reject(error);
        return;
      }

      resolve(in_doc_icon_url);
      return;
    }

    // If redirected to different url, check cache for redirect
    let redirect_entry;
    if(uniq_urls.length > 1) {
      try {
        redirect_entry = await favicon_find_entry(conn, response_url.href, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    // If the response url is in the cache, then resolve with that
    if(redirect_entry && !favicon_is_expired(redirect_entry, current_date)) {
      resolve(new URL(redirect_entry.iconURLString));
      return;
    }

    // Next, try checking if the origin url is in the cache if it is different
    const origin_url = new URL(url.origin);
    let origin_entry;
    if(!uniq_urls.includes(origin_url.href)) {
      uniq_urls.push(origin_url.href);
      try {
        origin_entry = await favicon_find_entry(conn, origin_url.href, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    // If we found an origin entry, resolve with that
    if(origin_entry && !favicon_is_expired(origin_entry, current_date)) {
      const icon_url = new URL(origin_entry.iconURLString);
      const tx = conn.transaction('favicon-cache', 'readwrite');
      try {
        let proms = uniq_urls.filter((url)=> url !== origin_url.href);
        proms = proms.map((url) => favicon_add_entry(tx, url, icon_url.href,
          log));
        await Promise.all(proms);
      } catch(error) {
        reject(error);
        return;
      }
      resolve(icon_url);
      return;
    }

    // Nothing is in the icon cache, and could not find in page. Fall back to
    // checking for image in domain root
    let image_size, image_response_url;
    try {
      [image_size, image_response_url] = await favicon_request_image(
        url.origin + '/favicon.ico', log);
    } catch(error) {
    }

    if(image_response_url && image_size > FAVICON_MIN_IMAGE_SIZE &&
      image_size < FAVICON_MAX_IMAGE_SIZE) {
      const image_url = new URL(image_response_url);
      const tx = conn.transaction('favicon-cache', 'readwrite');
      const proms = [];
      try {
        const proms = uniq_urls.map((url) => favicon_add_entry(tx, url,
          image_url.href, log));
        await Promise.all(proms);
        resolve(image_url);
        return;
      } catch(error) {
        reject(error);
        return;
      }
    }

    // All prior steps failed, clear the cache
    const proms = [];
    try {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      const proms = uniq_urls.map((url) => favicon_remove_entry(tx, url, log));
      await Promise.all(proms);
    } catch(error) {
      reject(error);
      return;
    }

    // Failed to find favicon
    resolve();
  });
}

function favicon_connect(name = FAVICON_DB_NAME, version = FAVICON_DB_VERSION,
  log = SilentConsole) {

  return new Promise(function(resolve, reject) {
    log.log('Connecting to database', name, 'version', version);
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = favicon_upgrade.bind(request, log);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      log.debug('Connected to database', conn.name);
      resolve(conn);
    };
    request.onerror = function(event) {
      reject(event.target.error);
    };
    request.onblocked = function(event) {
      console.warn('favicon_connect waiting indefinitely while blocked');
    };
  });
}

function favicon_upgrade(log, event) {
  const conn = event.target.result;
  log.log('Creating or upgrading database', conn.name);
  if(!conn.objectStoreNames.contains('favicon-cache')) {
    conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
}

function favicon_is_expired(entry, current_date, max_age = FAVICON_MAX_AGE) {
  const age = current_date - entry.dateUpdated;
  return age > max_age;
}

// @param conn {IDBDatabase}
// @param url {String}
// @param log {console}
function favicon_find_entry(conn, url, log) {
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
}

// @param tx {IDBTransaction}
// @param page_url {String}
// @param icon_url {String}
// @param log {console}
function favicon_add_entry(tx, page_url, icon_url, log) {
  return new Promise(function(resolve, reject) {
    const entry = {'pageURLString': page_url, 'iconURLString': icon_url,
      'dateUpdated': new Date()};
    log.debug('Adding favicon entry for', entry.pageURLString);
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = function onsuccess(event) { resolve(); };
    request.onerror = function onerror(event) { reject(event.target.error); };
  });
}

// @param tx {IDBTransaction}
// @param page_url {String}
// @param log {console-like}
function favicon_remove_entry(tx, page_url, log) {
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
}

function favicon_match_selector(ancestor, selector, base_url) {
  const element = ancestor.querySelector(selector);
  if(!element)
    return;
  const href = (element.getAttribute('href') || '').trim();
  // without this check the URL constructor would not throw
  if(!href)
    return;
  try {
    return new URL(href, base_url);
  } catch(error) {
  }
}

// TODO: maybe I can avoid parsing and just search raw text for
// <link> tags, the accuracy loss may be ok given the speed boost
// TODO: use streaming text api, stop reading on includes('</head>')
function favicon_fetch_doc(url, log) {
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
}

function favicon_request_image(image_url, log) {
  return new Promise(async function(resolve, reject) {
    log.debug('Fetching', image_url);
    const opts = {};
    opts.credentials = 'omit';
    opts.method = 'HEAD';

    // TODO: limit to image mime types
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
}


function compact_favicons(conn, log = SilentConsole) {
  return new Promise(async function compact_impl(resolve, reject) {
    log.log('Compacting favicons in database', conn.name);

    // Create a single transaction to share among all requests
    const tx = conn.transaction('favicon-cache', 'readwrite');

    // Load an array of all entries in the database
    let entries;
    try {
      entries = await favicon_get_entries(tx, log);
    } catch(error) {
      reject(error);
      return;
    }

    // Get a subset of expired entries. Use the same date, the call time of this
    // function, for determining whether an entry is expired
    const current_date = new Date();
    const expired_entries = entries.filter((entry) =>
      favicon_is_expired(entry, current_date));

    log.debug('Found %d expired entries', expired_entries.length);

    // Issue individual remove entry requests concurrently, and store the
    // remove promises in an array
    let remove_promises;
    try {
      remove_promises = expired_entries.map((entry) =>
        favicon_remove_entry(tx, entry.pageURLString, log));
    } catch(error) {
      reject(error);
      return;
    }

    // Wait for all the promises to resolve
    const resolutions = await Promise.all(remove_promises);
    log.debug('Deleted %d favicon entries', resolutions.length);
    resolve(resolutions.length);
  });
}

// Using the provided transaction, returns a promise that resolves to an array
// of all favicon entries in the database
// TODO: do I need the ||[] or is result guaranteed defined? I need to
// test on an empty database. moz docs say nothing
function favicon_get_entries(tx, log) {
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
}
