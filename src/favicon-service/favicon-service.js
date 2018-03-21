import * as html_parser from '/src/html-parser/html-parser.js';
import * as idb from '/src/idb/idb.js';
import * as mime from '/src/mime/mime.js';
import * as url_loader from '/src/url-loader/url-loader.js';

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
  this.console = null_console;
}

FaviconService.prototype.lookup = async function(url, document) {
  if (!(url instanceof URL)) {
    throw new TypeError('url is not a URL');
  }

  this.console.log('Lookup', url.href);

  const urls = [];
  urls.push(url.href);

  let origin_url = new URL(url.origin);
  let origin_entry;

  // Check the cache for the input url
  if (this.conn) {
    const entry = await this.find_entry(url);
    if (entry && entry.iconURLString && !this.is_expired(entry)) {
      return entry.iconURLString;
    }
    if (origin_url.href === url.href && entry &&
        entry.failureCount >= this.max_failure_count) {
      this.console.debug('Too many failures', url.href);
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
  }

  if (this.conn && origin_url.href !== url.href) {
    origin_entry = await this.find_entry(origin_url);
    if (origin_entry && origin_entry.failureCount > this.max_failure_count) {
      this.console.debug('Exceeded max failures', origin_url.href);
      return;
    }
  }

  let response;
  if (!document && !this.skip_fetch) {
    response = await url_loader.fetch_html(url, this.fetch_html_timeout);
    if (!response.ok) {
      this.console.debug('Fetch error', url.href, response.status);
    }
  }

  // on fetch failure, response.url may be undefined, so avoid passing undefined
  // to the URL constructor

  let response_url;
  if (response && response.url) {
    response_url = new URL(response.url);
    if (url_loader.url_did_change(url, response_url)) {
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

  document = null;
  if (response) {
    const text = await response.text();
    try {
      document = html_parser.parse(text);
    } catch (error) {
      this.console.debug(error);
    }
  }

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

  if (this.conn && !urls.includes(origin_url.href)) {
    origin_entry = await this.find_entry(origin_url);
    if (origin_entry) {
      if (origin_entry.iconURLString && !this.is_expired(origin_entry)) {
        await this.put_all(urls, origin_entry.iconURLString);
        return origin_entry.iconURLString;
      } else if (origin_entry.failureCount >= this.max_failure_count) {
        this.console.debug('Failures exceeded', origin_url.href);
        return;
      }
    }
  }

  if (!urls.includes(origin_url.href)) {
    urls.push(origin_url.href);
  }

  const base_url = response_url ? response_url : url;
  const image_url = new URL(base_url.origin + '/favicon.ico');
  response = await this.head_image(image_url);

  if (response) {
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

FaviconService.prototype.on_lookup_fail =
    function(origin_url, origin_entry) {
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
}

    FaviconService.prototype.is_expired = function(entry) {
  if (!entry.dateUpdated) {
    this.console.warn('Missing date updated', entry);
    return false;
  }

  const current_date = new Date();
  const entry_age = current_date - entry.dateUpdated;
  if (entry_age < 0) {
    this.console.warn('Date updated is in the future', entry);
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
    const response = await this.head_image(url);
    if (response) {
      return response.url;
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
  return idb.idb_open(
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
    this.console.log('Clearing favicon store');
    const txn = this.conn.transaction('favicon-cache', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('favicon-cache');
    store.clear();
  });
};

FaviconService.prototype.compact = function() {
  return new Promise((resolve, reject) => {
    this.console.log('Compacting favicon store...');
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
        this.console.debug('Deleting favicon entry', cursor.value);
        cursor.delete();
        cursor.continue();
      }
    };
  });
};

FaviconService.prototype.find_entry = function(url) {
  return new Promise((resolve, reject) => {
    if (!(url instanceof URL)) {
      reject(new TypeError('url is not a URL'));
      return;
    }

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

// TODO: rather than return undefined in the event of an error, this should
// guarantee a defiend response is returned in the non-exception case, similar
// to the internals of url-loader API calls. The caller should be checking
// response.ok and not if response defined. Furthermore, the !response.ok check
// here should be removed, and the range check should be modified to be within
// if(response.ok) block
FaviconService.prototype.head_image = async function(url) {
  const options = {method: 'head', timeout: this.fetch_image_timeout};
  const response = await url_loader.fetch_image(url, options);

  if (!response.ok) {
    this.console.debug('not ok', url.href, response.status);
    return;
  }

  // Type validation now done by fetch_image
  /*
    const content_type = response.headers.get('Content-Type');
    if (!content_type) {
      this.console.debug('unknown content type', url.href);
      return;
    }

    const mime_type = mime.parse_content_type(content_type);
    if (!mime_type) {
      this.console.debug('malformed content type', url.href, content_type);
      return;
    }

    if (!mime_type.startsWith('image/') &&
        mime_type !== 'application/octet-stream') {
      this.console.debug('unacceptable mime type', url.href, mime_type);
      return;
    }
  */

  // Assert the response is in range
  const content_len = response.headers.get('Content-Length');
  const size = parseInt(content_len, 10);
  if (!isNaN(size) &&
      (size < this.min_image_size || size > this.max_image_size)) {
    this.console.debug('image size not in range', url.href, size);
    return;
  }

  return response;
};

FaviconService.prototype.try_resolve = function(url_string, base_url) {
  assert(base_url instanceof URL);
  if (typeof url_string === 'string' && url_string.trim()) {
    try {
      return new URL(url_string, base_url);
    } catch (error) {
    }
  }
};

function assert(value, message) {
  if (!value) {
    throw new Error(message || 'Assertion error');
  }
}

function noop() {}

const null_console = {
  log: noop,
  warn: noop,
  debug: noop
};
