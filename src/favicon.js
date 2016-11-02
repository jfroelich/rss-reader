// See license.md

'use strict';

// TODO: lookup should no longer accept db_target and connect on demand,
// require caller to pass in conn. This allow easy testing on diff db, and
// fewer params, and is better now that calling externally is easier
// TODO: connect should just accept name, version, no need to wrap in object
// TODO: look into decoupling silent-console so that this has no deps, maybe
// accept console as input and have each debug use if(console)

// TODO: maybe lookup should accept a string and return a string, it simplifies
// things. it can still use URL internally where needed

// food for thought: why have some of the helper functions return promises,
// when in fact these could be async calls that block until return, and just
// return the output. from the outside the functions just look like sync
// functions. for example, why not have favicon_connect just return a conn?
// why return a promise? every single call to favicon_connect awaits it,
// because there is no concern about concurrency, about calling while also
// doing other work

const FAVICON_DB_NAME = 'favicon-cache';
const FAVICON_DB_VERSION = 1;
const FAVICON_DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

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

function favicon_is_expired(entry, current_date,
  max_age = FAVICON_DEFAULT_MAX_AGE) {
  const age = current_date - entry.dateUpdated;
  return age >= max_age;
}

function favicon_find_entry(conn, log, url) {
  return new Promise(function(resolve, reject) {
    log.log('Checking favicon cache for page url', url.href);
    const page_url = favicon_normalize_url(url).href;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(page_url);
    request.onsuccess = function(event) {
      const entry = event.target.result;
      log.debug('favicon cache lookup result for url', page_url, 'is',
        entry ? entry.iconURLString : 'null');
      resolve(entry);
    };
    request.onerror = function(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

function favicon_add_entry(conn, log, page_url, icon_url) {
  return new Promise(function(resolve, reject) {
    const entry = {};
    entry.pageURLString = favicon_normalize_url(page_url).href;
    entry.iconURLString = icon_url.href;
    entry.dateUpdated = new Date();
    log.debug('Adding favicon entry', entry);
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = function(event) {
      resolve(entry);
    };
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

function favicon_remove_entry(tx, page_url, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Removing favicon entry with page url', page_url.href);
    const norm_url = favicon_normalize_url(page_url).href;
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(norm_url);
    request.onsuccess = function(event) {
      resolve();
    };
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

function favicon_normalize_url(url) {
  const clone = new URL(url.href);
  clone.hash = '';
  return clone;
}

// TODO: break up the big try/catch into smaller ones to handle error cases
// separately and reduce indentation and not wrap non-error statements
// TODO: look more into whether I always need to await a promise within a
// try/catch
function favicon_lookup(conn, url, log = SilentConsole) {
  return new Promise(async function lookup_impl(resolve, reject) {
    log.log('Looking up favicon for url', url.href);
    const current_date = new Date();

    try {
      let entry = await favicon_find_entry(conn, log, url);
      if(entry  && !favicon_is_expired(entry, current_date)) {
        resolve(new URL(entry.iconURLString));
        return;
      }

      // Check if offline
      if('onLine' in navigator && !navigator.onLine) {
        // TODO: should this reject?
        resolve();
        return;
      }

      let fetch_result = null;
      let fetched_doc = null;
      let response_url = null;
      try {
        fetch_result = await favicon_fetch_doc(url, log);
        fetched_doc = fetch_result.responseXML;
        response_url = new URL(fetch_result.responseURL);
      } catch(fetch_error) {
        log.debug('Error fetching', url.href, fetch_error);
        const tx = conn.transaction('favicon-cache', 'readwrite');
        await favicon_remove_entry(tx, url, log);
      }

      if(fetched_doc) {
        const icon_url = favicon_search_doc(fetched_doc, url);
        if(icon_url) {
          await favicon_add_entry(conn, log, url, icon_url);
          if(url.href !== response_url.href)
            await favicon_add_entry(conn, log, response_url, icon_url);
          resolve(icon_url);
          return;
        }
      }

      if(response_url && response_url.href !== url.href) {
        log.debug('Falling back to checking cache for redirect url');
        let redirect_entry = await favicon_find_entry(conn, log, response_url);
        if(redirect_entry &&
          !favicon_is_expired(redirect_entry, current_date)) {
          resolve(new URL(redirect_entry.iconURLString));
          return;
        }
      }

      const origin_url = new URL(url.origin);
      if(origin_url.href !== url.href &&
        (!response_url || origin_url.href !== response_url.href)) {
        let origin_entry = await favicon_find_entry(conn, log, origin_url);
        if(origin_entry && !favicon_is_expired(origin_entry, current_date)) {
          const icon_url = new URL(origin_entry.iconURLString);
          await favicon_add_entry(conn, log, url, icon_url);
          if(response_url)
            await favicon_add_entry(conn, log, response_url, icon_url);
          await favicon_add_entry(conn, log, origin_url, icon_url);
          resolve(icon_url);
          return;
        }
      }

      const origin_icon_url = new URL(url.origin + '/favicon.ico');
      let image_response = null;
      try {
        image_response = await favicon_request_image(origin_icon_url);
      } catch(fetch_error) {
        // log.debug(fetch_error);
      }

      if(image_response) {
        const size = favicon_get_response_size(image_response);
        if(favicon_is_response_size_in_range(size)) {
          const type = image_response.getResponseHeader('Content-Type');
          if(favicon_is_response_type_img(type)) {
            let image_response_url = new URL(image_response.responseURL);
            await favicon_add_entry(conn, log, url, image_response_url);
            if(response_url && url.href !== response_url.href)
              await favicon_add_entry(conn, log, response_url,
                image_response_url);
            if(origin_url.href !== url.href &&
              (!response_url || response_url.href !== origin_url.href))
              await favicon_add_entry(conn, log, origin_url,
                image_response_url);
            resolve(image_response_url);
            return;
          }
        }
      }

      // Lookups and fetches failed, ensure cache is cleared
      const tx = conn.transaction('favicon-cache', 'readwrite');
      await favicon_remove_entry(tx, url, log);
      if(response_url && response_url.href !== url.href)
        await favicon_remove_entry(tx, response_url, log);
      if(origin_url.href !== url.href &&
        (!response_url || origin_url.href !== response_url.href))
        await favicon_remove_entry(tx, origin_url, log);
      resolve();
    } catch(error) {
      reject(error);
    }
  });
}



const favicon_selectors = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

// TODO: validate the url exists by sending a HEAD request for matches?
function favicon_search_doc(doc, base_url) {
  if(doc.documentElement.localName !== 'html' || !doc.head) {
    return;
  }

  for(let selector of favicon_selectors) {
    const icon_url = favicon_match_selector(doc, selector, base_url);
    if(icon_url)
      return icon_url;
  }
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

// TODO: use fetch api
// TODO: maybe even inline because I can await fetch
function favicon_fetch_doc(url, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Fetching', url.href);
    const request = new XMLHttpRequest();
    request.responseType = 'document';
    request.onerror = function(event) {
      reject(event.target.error);
    };
    request.ontimeout = function(event) {
      reject(event.target.error);
    };
    request.onabort = function(event) {
      reject(event.target.error);
    };
    request.onload = function(event) {
      resolve(event.target);
    };
    request.open('GET', url.href, true);
    request.setRequestHeader('Accept', 'text/html');
    request.send();
  });
}

// TODO: use fetch api
// TODO: actually the caller could use the fetch api directly, this would
// avoid the need to have a promise or another function
function favicon_request_image(image_url) {
  return new Promise(function(resolve, reject) {
    const request = new XMLHttpRequest();
    request.timeout = 1000;
    request.ontimeout = function(event) {
      reject(new Error('timeout'));
    };
    request.onabort = function(event) {
      reject(new Error('abort'));
    };
    request.onerror = function(event) {
      reject(new Error('error'));
    };
    request.onload = function(event) {
      resolve(event.target);
    };
    request.open('HEAD', image_url.href, true);
    request.setRequestHeader('Accept', 'image/*');
    request.send();
  });
}

function favicon_get_response_size(response) {
  const len_str = response.getResponseHeader('Content-Length');
  let len_int = 0;
  if(len_str) {
    try {
      len_int = parseInt(len_str, 10);
    } catch(error) {
    }
  }
  return len_int;
}

function favicon_is_response_size_in_range(size) {
  const min_size = 49;
  const max_size = 10001;
  return size > min_size && size < max_size;
}

function favicon_is_response_type_img(type) {
  return /^\s*image\//i.test(type);
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
        favicon_remove_entry(tx, new URL(entry.pageURLString), log));
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
function favicon_get_entries(tx, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Getting all favicon entries from database', tx.db.name);
    const store = tx.objectStore('favicon-cache');
    const request = store.getAll();
    request.onsuccess = function(event) {
      // TODO: do I need the ||[] or is result guaranteed defined? I need to
      // test on an empty database
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
