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
const FAVICON_DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

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
      entry = await favicon_find_entry(conn, url, log);
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

    // We are online. Attempt to fetch
    // TODO: this should be using the new fetch api
    let fetch_result = null;
    try {
      fetch_result = await favicon_fetch_doc(url, log);
    } catch(error) {
    }

    // If the fetch failed but we have an entry, remove it
    if(entry && !fetch_result) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      try {
        await favicon_remove_entry(tx, url, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    let doc, response_url;
    if(fetch_result) {
      doc = fetch_result.responseXML;
      response_url = new URL(fetch_result.responseURL);
      if(response_url.href !== url.href)
        uniq_urls.push(response_url.href);
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
    // TODO: can maybe just use uniq_urls.map()? but it is strings
    if(in_doc_icon_url) {
      log.debug('Found favicon <link>', url.href, in_doc_icon_url.href);
      const tx = conn.transaction('favicon-cache', 'readwrite');
      const proms = [];
      try {
        proms.push(favicon_add_entry(tx, url, in_doc_icon_url, log));
        if(uniq_urls.length > 1)
          proms.push(favicon_add_entry(tx, response_url, in_doc_icon_url, log));
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
        redirect_entry = await favicon_find_entry(conn, response_url, log);
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
        origin_entry = await favicon_find_entry(conn, origin_url, log);
      } catch(error) {
        reject(error);
        return;
      }
    }

    // If we found an origin entry, resolve with that. Also add or replace the
    // other entries
    if(origin_entry && !favicon_is_expired(origin_entry, current_date)) {
      const icon_url = new URL(origin_entry.iconURLString);
      const tx = conn.transaction('favicon-cache', 'readwrite');
      const proms = [];
      try {
        proms.push(favicon_add_entry(tx, url, icon_url, log));
        if(uniq_urls.includes(response_url.href))
          proms.push(favicon_add_entry(tx, response_url, icon_url, log));
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
    const origin_icon_url = new URL(url.origin + '/favicon.ico');
    let image_response;
    try {
      image_response = await favicon_request_image(origin_icon_url, log);
    } catch(error) {
    }

    let image_size, image_type;
    if(image_response) {
      image_size = favicon_get_response_size(image_response);
      image_type = image_response.getResponseHeader('Content-Type');
    }

    if(image_response && image_size > FAVICON_MIN_IMAGE_SIZE &&
      image_size < FAVICON_MAX_IMAGE_SIZE &&
      /^\s*image\//i.test(image_type)) {
      const image_url = new URL(image_response.responseURL);
      const tx = conn.transaction('favicon-cache', 'readwrite');
      // TODO: can just map uniq_urls? but it is strings
      const proms = [];
      try {
        proms.push(favicon_add_entry(tx, url, image_url, log));
        if(response_url && url.href !== response_url.href)
          proms.push(favicon_add_entry(tx, response_url, image_url, log));
        if(origin_url.href !== url.href &&
          (!response_url || response_url.href !== origin_url.href))
          proms.push(favicon_add_entry(tx, origin_url, image_url, log));
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
      if(entry)
        proms.push(favicon_remove_entry(tx, url, log));
      if(redirect_entry)
        proms.push(favicon_remove_entry(tx, response_url, log));
      if(origin_entry)
        proms.push(favicon_remove_entry(tx, origin_url, log));
      await Promise.all(proms);
    } catch(error) {
      reject(error);
      return;
    }

    // Resolve with nothing
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

function favicon_is_expired(entry, current_date,
  max_age = FAVICON_DEFAULT_MAX_AGE) {
  const age = current_date - entry.dateUpdated;
  return age >= max_age;
}

function favicon_find_entry(conn, url, log) {
  return new Promise(function(resolve, reject) {
    log.log('Checking favicon cache for page url', url.href);
    const page_url = url.href;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(page_url);
    request.onsuccess = function(event) {
      const entry = event.target.result;
      if(entry)
        log.debug('Favicon cache hit', page_url, entry.iconURLString);
      resolve(entry);
    };
    request.onerror = function(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

function favicon_add_entry(tx, page_url, icon_url, log) {
  return new Promise(function(resolve, reject) {
    const entry = {
      'pageURLString': page_url.href,
      'iconURLString': icon_url.href,
      'dateUpdated': new Date()
    };
    log.debug('Adding favicon entry for', entry.pageURLString);
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = function(event) { resolve(); };
    request.onerror = function(event) { reject(event.target.error); };
  });
}

function favicon_remove_entry(tx, page_url, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Removing favicon entry with page url', page_url.href);
    const norm_url = page_url.href;
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
      log.debug('Fetched', url.href);
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
function favicon_request_image(image_url, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Fetching', image_url.href);
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
      log.debug('Fetched', image_url.href);
      resolve(event.target);
    };
    request.open('HEAD', image_url.href, true);
    request.setRequestHeader('Accept', 'image/*');
    request.send();
  });
}

// TODO: inline
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
