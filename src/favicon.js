// See license.md

'use strict';

// TODO: now i need to update all call sites of favicon_lookup to not use
// a cache object
// TODO: merge compact-favicons here
// TODO: maybe a favicon namespace object would be better

const FAVICON_DB_DEFAULT_TARGET = {
  'name': 'favicon-cache',
  'version': 1
};

const FAVICON_DEFAULT_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

function favicon_db_connect(target = FAVICON_DB_DEFAULT_TARGET,
  log = SilentConsole) {
  return new Promise(function(resolve, reject) {
    log.log('Connecting to database', target.name, 'version', target.version);
    const request = indexedDB.open(target.name, target.version);
    request.onupgradeneeded = favicon_db_upgrade.bind(request, log);
    request.onsuccess = function(event) {
      const conn = event.target.result;
      log.debug('Connected to database', conn.name);
      resolve(conn);
    };
    request.onerror = function(event) {
      reject(event.target.error);
    };
    request.onblocked = function(event) {
      console.warn('waiting indefinitely while blocked');
    };
  });
}

function favicon_db_upgrade(log, event) {
  const conn = event.target.result;
  log.log('Creating or upgrading database', conn.name);
  if(!conn.objectStoreNames.contains('favicon-cache')) {
    conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
}

function favicon_entry_is_expired(entry, max_age) {
  const age = new Date() - entry.dateUpdated;
  return age >= max_age;
}

function favicon_db_find_entry(conn, log, url) {
  return new Promise(function(resolve, reject) {
    log.log('Checking favicon cache for page url', url.href);
    const page_url = favicon_normalize_url(url).href;
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(page_url);
    request.onsuccess = function(event) {
      const entry = event.target.result;
      log.debug('find result', entry);
      resolve(entry);
    };
    request.onerror = function(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

function favicon_db_add_entry(conn, log, page_url, icon_url) {
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

function favicon_db_remove_entry(conn, log, page_url) {
  return new Promise(function(resolve, reject) {
    log.debug('Removing favicon entry with page url', page_url.href);
    const norm_url = favicon_normalize_url(page_url).href;
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.delete(norm_url);
    request.onsuccess = resolve;
    request.onerror = function(event) {
      reject(event.target.error);
    };
  });
}

function favicon_db_get_entries(conn, log) {
  return new Promise(function(resolve, reject) {
    const entries = [];
    log.debug('Getting all favicon entries');
    const tx = conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.openCursor();
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(cursor) {
        entries.push(cursor.value);
        cursor.continue();
      } else {
        log.debug('Got %d favicon entries', entries.length);
        resolve(entries);
      }
    };
    request.onerror = function(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

function favicon_normalize_url(url) {
  const clone = new URL(url.href);
  clone.hash = '';
  return clone;
}

function favicon_lookup(db_target = FAVICON_DB_DEFAULT_TARGET, conn, url, doc,
  log = SilentConsole) {
  return new Promise(
    favicon_lookup_impl.bind(null, db_target, conn, url, doc, log));
}

// todo: if finally always evaluates even if return then i do not need the
// close db calls at each return
async function favicon_lookup_impl(db_target, conn, url, doc, log, resolve,
  reject) {
  log.log('Looking up favicon for url', url.href);
  let should_close_conn = false;
  try {
    if(!conn) {
      conn = await favicon_db_connect(db_target, log);
      should_close_conn = true;
    }

    if(doc) {
      const icon_url = favicon_search_doc(doc, url);
      if(icon_url) {
        log.debug('Found icon in prefetched doc', icon_url.href);
        favicon_db_add_entry(conn, log, url, icon_url);
        if(should_close_conn)
          conn.close();
        resolve(icon_url);
        return;
      }
    }

    let entry = await favicon_db_find_entry(conn, log, url);
    if(entry) {
      if(!favicon_entry_is_expired(entry, FAVICON_DEFAULT_MAX_AGE)) {
        if(should_close_conn)
          conn.close();
        resolve(new URL(entry.iconURLString));
        return;
      }
    }

    // Check if offline
    if('onLine' in navigator && !navigator.onLine) {
      if(should_close_conn)
        conn.close();
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
      favicon_db_remove_entry(conn, log, url);
    }

    if(fetched_doc) {
      const icon_url = favicon_search_doc(fetched_doc, url);
      if(icon_url) {
        favicon_db_add_entry(conn, log, url, icon_url);
        if(url.href !== response_url.href)
          favicon_db_add_entry(conn, log, response_url, icon_url);
        if(should_close_conn)
          conn.close();
        resolve(icon_url);
        return;
      }
    }

    if(response_url && response_url.href !== url.href) {
      log.debug('Falling back to checking cache for redirect url');
      let redirect_entry = await favicon_db_find_entry(conn, log,
        response_url);
      if(redirect_entry &&
        !favicon_entry_is_expired(redirect_entry,
          FAVICON_DEFAULT_MAX_AGE)) {
        if(should_close_conn)
          conn.close();
        resolve(new URL(redirect_entry.iconURLString));
        return;
      }
    }

    const origin_url = new URL(url.origin);
    if(origin_url.href !== url.href &&
      (!response_url || origin_url.href !== response_url.href)) {
      let origin_entry = await favicon_db_find_entry(conn, log, origin_url);
      if(origin_entry && !favicon_entry_is_expired(origin_entry,
        FAVICON_DEFAULT_MAX_AGE)) {
        const icon_url = new URL(entry.iconURLString);
        favicon_db_add_entry(conn, log, url, icon_url);
        if(response_url)
          favicon_db_add_entry(conn, log, response_url, icon_url);
        favicon_db_add_entry(conn, log, origin_url, icon_url);
        if(should_close_conn)
          conn.close();
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
          favicon_db_add_entry(conn, log, url, image_response_url);
          if(response_url && url.href !== response_url.href)
            favicon_db_add_entry(conn, log, response_url, image_response_url);
          if(origin_url.href !== url.href &&
            (!response_url || response_url.href !== origin_url.href))
            favicon_db_add_entry(conn, log, origin_url, image_response_url);
          if(should_close_conn)
            conn.close();
          resolve(image_response_url);
          return;
        }
      }
    }

    // Lookups and fetches failed, ensure cache is cleared
    favicon_db_remove_entry(conn, log, url);
    if(response_url && response_url.href !== url.href)
      favicon_db_remove_entry(conn, log, response_url);
    if(origin_url.href !== url.href &&
      (!response_url || origin_url.href !== response_url.href))
      favicon_db_remove_entry(conn, log, origin_url);
    if(should_close_conn)
      conn.close();
    resolve();
  } catch(error) {
    reject(error);
  } finally {
    if(conn && should_close_conn)
      conn.close();
  }
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
  const favicon_min_img_response_size = 49;
  const favicon_max_img_response_size = 10001;
  return size > favicon_min_img_response_size &&
    size < favicon_max_img_response_size;
}

function favicon_is_response_type_img(type) {
  return /^\s*image\//i.test(type);
}
