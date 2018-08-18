import assert from '/src/lib/assert.js';
import {fetch_html} from '/src/lib/fetch-html.js';
import {fetch2, response_is_redirect} from '/src/lib/fetch2.js';
import * as html from '/src/lib/html.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import * as mime from '/src/lib/mime.js';

export function FaviconService() {
  this.name = 'favicon-cache';
  this.version = 3;
  this.open_timeout = 500;
  this.conn;
  this.max_age = 1000 * 60 * 60 * 24 * 30;
  this.max_failure_count = 2;
  this.skip_fetch = false;
  this.fetch_html_timeout = 5000;
  this.fetch_image_timeout = 1000;
  this.min_image_size = 50;
  this.max_image_size = 10240;
}

FaviconService.prototype.lookup = async function favicon_lookup(url, document) {
  if (!url['href']) {
    throw new TypeError('url is not url-like, missing href accessor');
  }

  console.log('%s: lookup', favicon_lookup.name, url.href);

  const urls = [];
  urls.push(url.href);

  let origin_url = new URL(url.origin);
  let origin_entry;

  // Check the cache for the input url
  if (this.conn) {
    const entry = await this.find_entry(url);
    if (entry && entry.iconURLString && !this.is_expired(entry)) {
      console.debug('%s: hit', favicon_lookup.name, entry.iconURLString);
      return entry.iconURLString;
    }
    if (origin_url.href === url.href && entry &&
        entry.failureCount >= this.max_failure_count) {
      console.debug('Too many failures', url.href);
      return;
    }
  }

  if (document) {
    const icon_url_string = await this.search_document(document, url);
    if (icon_url_string) {
      if (this.conn) {
        await this.put_all(urls, icon_url_string);
      }
      return icon_url_string;
    }

    document = null;  // Dereference for later reuse without ambiguity
  }

  if (this.conn && origin_url.href !== url.href) {
    origin_entry = await this.find_entry(origin_url);
    if (origin_entry && origin_entry.failureCount > this.max_failure_count) {
      console.debug('Exceeded max failures', origin_url.href);
      return;
    }
  }

  let response;
  if (!document && !this.skip_fetch) {
    try {
      response = await fetch_html(url, this.fetch_html_timeout);
    } catch (error) {
      // not fatal error
      console.debug('Fetch error', url.href, error);
    }
  }

  // Check redirect url
  let response_url;
  if (response && response.ok && response.url) {
    response_url = new URL(response.url);
    if (response_is_redirect(url, response)) {
      if (response_url.origin !== url.origin) {
        origin_url = new URL(response_url.origin);
      }
      urls.push(response_url.href);

      if (this.conn) {
        let entry = await this.find_entry(response_url);
        if (entry && entry.iconURLString && !this.is_expired(entry)) {
          await this.put_all([url.href], entry.iconURLString);
          return entry.iconURLString;
        }
      }
    }
  }

  if (response && response.ok) {
    const text = await response.text();
    try {
      document = html.parse_html(text);
    } catch (error) {
      console.debug(error);
    }
  }

  // Search fetched document
  if (document) {
    const base_url = response_url ? response_url : url;
    const icon_url_string = await this.search_document(document, base_url);
    if (icon_url_string) {
      if (this.conn) {
        await this.put_all(urls, icon_url_string);
      }
      return icon_url_string;
    }
  }

  // Check origin cache
  if (this.conn && !urls.includes(origin_url.href)) {
    origin_entry = await this.find_entry(origin_url);
    if (origin_entry) {
      if (origin_entry.iconURLString && !this.is_expired(origin_entry)) {
        await this.put_all(urls, origin_entry.iconURLString);
        return origin_entry.iconURLString;
      } else if (origin_entry.failureCount >= this.max_failure_count) {
        console.debug(
            '%s: failures exceeded', favicon_lookup.name, origin_url.href);
        return;
      }
    }
  }

  // Check for favicon.ico
  const base_url = response_url ? response_url : url;
  const image_url = new URL(base_url.origin + '/favicon.ico');

  try {
    response = await this.head_image(image_url);
  } catch (error) {
  }


  if (response && response.ok) {
    if (!urls.includes(origin_url.href)) {
      urls.push(origin_url.href);
    }

    const response_url = new URL(response.url);
    if (this.conn) {
      await this.put_all(urls, response_url.href);
    }
    return response_url.href;
  }

  if (this.conn) {
    this.on_lookup_fail(origin_url, origin_entry);
  }
};

FaviconService.prototype.on_lookup_fail = function(origin_url, origin_entry) {
  if (origin_entry) {
    const new_entry = {};
    new_entry.pageURLString = origin_entry.pageURLString;
    new_entry.dateUpdated = new Date();
    new_entry.iconURLString = origin_entry.iconURLString;
    if ('failureCount' in origin_entry) {
      if (origin_entry.failureCount <= this.max_failure_count) {
        new_entry.failureCount = origin_entry.failureCount + 1;
        this.put_entry(new_entry);
      }
    } else {
      new_entry.failureCount = 1;
      this.put_entry(new_entry);
    }
  } else {
    const new_entry = {};
    new_entry.pageURLString = origin_url.href;
    new_entry.iconURLString = undefined;
    new_entry.dateUpdated = new Date();
    new_entry.failureCount = 1;
    this.put_entry(new_entry);
  }
};

FaviconService.prototype.is_expired = function(entry) {
  if (!entry.dateUpdated) {
    console.warn('Missing date updated', entry);
    return false;
  }

  const current_date = new Date();
  const entry_age = current_date - entry.dateUpdated;
  if (entry_age < 0) {
    console.warn('Date updated is in the future', entry);
    return false;
  }

  return entry_age > this.max_age;
};

FaviconService.prototype.search_document = async function(document, base_url) {
  const candidates = this.find_candidate_urls(document);

  let urls = [];
  for (const url of candidates) {
    const canonical = this.try_resolve(url, base_url);
    if (canonical) {
      urls.push(canonical);
    }
  }

  const seen = [];
  const distinct = [];
  for (const url of urls) {
    if (!seen.includes(url.href)) {
      distinct.push(url);
      seen.push(url.href);
    }
  }
  urls = distinct;

  for (const url of urls) {
    try {
      const response = await this.head_image(url);
      return response.url;
    } catch (error) {
    }
  }
};

FaviconService.prototype.find_candidate_urls = function(document) {
  const selector = [
    'link[rel="icon"][href]', 'link[rel="shortcut icon"][href]',
    'link[rel="apple-touch-icon"][href]',
    'link[rel="apple-touch-icon-precomposed"][href]'
  ].join(',');

  if (!document.head) {
    return [];
  }

  const links = document.head.querySelectorAll(selector);
  const candidates = [];
  for (const link of links) {
    const href = link.getAttribute('href');
    if (href) {
      candidates.push(href);
    }
  }

  return candidates;
};

FaviconService.prototype.open = function() {
  return indexeddb.open(
      this.name, this.version, this.onupgradeneeded, this.open_timeout);
};

FaviconService.prototype.onupgradeneeded = function(event) {
  const conn = event.target.result;
  console.log('Creating or upgrading database', conn.name);

  let store;
  if (!event.oldVersion || event.oldVersion < 1) {
    console.debug('Creating favicon-cache store');
    store = conn.createObjectStore('favicon-cache', {keyPath: 'pageURLString'});
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if (event.oldVersion < 2) {
    console.debug('Creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }
};

FaviconService.prototype.clear = function() {
  return new Promise((resolve, reject) => {
    console.log('Clearing favicon store');
    const txn = this.conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('favicon-cache');
    store.clear();
  });
};

FaviconService.prototype.compact = function() {
  return new Promise((resolve, reject) => {
    console.log('Compacting favicon store...');
    const cutoff_time = Date.now() - this.max_age;
    assert(cutoff_time >= 0);
    const cutoff_date = new Date(cutoff_time);
    const txn = this.conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const range = IDBKeyRange.upperBound(cutoff_date);
    const request = index.openCursor(range);
    request.onsuccess = _ => {
      const cursor = request.result;
      if (cursor) {
        console.debug('Deleting favicon entry', cursor.value);
        cursor.delete();
        cursor.continue();
      }
    };
  });
};

FaviconService.prototype.find_entry = function(url) {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('favicon-cache');
    const store = txn.objectStore('favicon-cache');
    const request = store.get(url.href);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
};

FaviconService.prototype.put_entry = function(entry) {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('favicon-cache', 'readwrite');
    const store = txn.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
};

FaviconService.prototype.put_all = function(url_strings, icon_url_string) {
  return new Promise((resolve, reject) => {
    assert(Array.isArray(url_strings));
    assert(typeof icon_url_string === 'string');

    const txn = this.conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('favicon-cache');
    const current_date = new Date();
    const entry = {
      pageURLString: null,
      iconURLString: icon_url_string,
      dateUpdated: current_date,
      failureCount: 0
    };

    for (const url_string of url_strings) {
      entry.pageURLString = url_string;
      store.put(entry);
    }
  });
};

FaviconService.prototype.in_range = function(response) {
  const length_string = response.headers.get('Content-Length');
  const length = parseInt(length_string, 10);
  return isNaN(length) ||
      (length >= this.min_image_size && length <= this.max_image_size);
};

FaviconService.prototype.head_image = async function(url) {
  const options = {method: 'head', timeout: this.fetch_image_timeout};
  const response = await fetch_image(url, options);
  if (!this.in_range(response)) {
    throw new Error('response not in range');
  }

  return response;
};

FaviconService.prototype.try_resolve = function(url_string, base_url) {
  if (typeof url_string === 'string' && url_string.trim()) {
    try {
      return new URL(url_string, base_url);
    } catch (error) {
    }
  }
};

function fetch_image(url, options) {
  const image_mime_types = [
    'application/octet-stream', 'image/x-icon', 'image/jpeg', 'image/gif',
    'image/png', 'image/svg+xml', 'image/tiff', 'image/webp',
    'image/vnd.microsoft.icon'
  ];

  // Pretend that options is immutable, so clone as to remain pure
  const options_clone = Object.assign({types: image_mime_types}, options);

  // Defer to the load's default policy by using an undefined parameter
  let undefined_policy;
  return fetch2(url, options_clone, undefined_policy);
}
