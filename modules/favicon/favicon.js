// See license.md

'use strict';

// Favicon service module
class Favicon {

  // Connect to the favicon cache database. If name or version are not provided
  // then the default name and version are used.
  // @param name {String} database name
  // @param version {int} version number
  static connect(name = Favicon.DB_NAME, version = Favicon.DB_VERSION) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = this._upgrade.bind(this);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = console.warn;
    });
  }

  // Given a url, lookup the associated favicon url. Tries to follow the spec by
  // first checking for the icon in the page, then checking in the domain root.
  // @param conn {IDBDatabase}
  // @param url {URL}
  // @param log {console}
  // @returns {String} the icon url or null/undefined
  static async lookup(conn, url, log = Favicon.console) {
    log.log('LOOKUP', url.href);
    const uniq_urls = [url.href];
    const current_date = new Date();

    // Lookup the url in the cache
    const entry = await this.find(conn, url.href);
    if(entry && !this.is_expired(entry, current_date))
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
        await this.fetchDocument(url.href, fetch_html_timeout);
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
      await this.remove(tx, url.href);
    }

    // If the document is valid, then search for links in the head, and
    // ensure the links are absolute. Use the first valid link found.
    // TODO: use a single querySelectorAll?
    const selectors = [
      'link[rel="icon"][href]',
      'link[rel="shortcut icon"][href]',
      'link[rel="apple-touch-icon"][href]',
      'link[rel="apple-touch-icon-precomposed"][href]'
    ];
    let doc_icon_url;
    let base_url = response_url ? response_url : url;
    if(doc && doc.documentElement.localName === 'html' && doc.head) {
      for(let selector of selectors) {
        doc_icon_url = this.match(doc.head, selector, base_url);
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
      const proms = uniq_urls.map((url) => this.add(tx, url,
        doc_icon_url.href));
      await Promise.all(proms);
      return doc_icon_url.href;
    }

    // If redirected to different url, check cache for redirect
    let redirect_entry;
    if(uniq_urls.length > 1) {
      redirect_entry = await this.find(conn, response_url.href);
    }

    // If the redirect url is in the cache, then resolve with that
    if(redirect_entry && !this.is_expired(redirect_entry, current_date)) {
      return redirect_entry.iconURLString;
    }

    // Next, try checking if the origin url is in the cache if it is different
    let origin_entry;
    if(!uniq_urls.includes(url.origin)) {
      uniq_urls.push(url.origin);
      origin_entry = await this.find(conn, url.origin);
    }

    // If we found an origin entry, resolve with that
    if(origin_entry && !this.is_expired(origin_entry, current_date)) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      // Do not re-add the origin entry
      let proms = uniq_urls.filter((url)=> url !== url.origin);
      // Do add the url and possible redirect url, because those failed
      proms = proms.map((url) => this.add(tx, url, origin_entry.iconURLString));
      await Promise.all(proms);
      return origin_entry.iconURLString;
    }

    // Fall back to checking domain root
    const fetch_image_timeout = 100;
    let image_size, image_response_url;
    try {
      ({image_size, image_response_url} = await this.fetchImageHead(
        url.origin + '/favicon.ico', fetch_image_timeout));
    } catch(error) {
    }

    const size_in_range = image_size === -1 ||
      (image_size > Favicon.MIN_SIZE && image_size < Favicon.MAX_SIZE);

    // If fetched and size is in range, then resolve to it
    if(image_response_url && size_in_range) {
      const tx = conn.transaction('favicon-cache', 'readwrite');
      const proms = uniq_urls.map((url) => this.add(tx, url,
        image_response_url));
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
      const proms = expired_urls.map((url) => this.remove(tx, url));
      await Promise.all(proms);
    }

    return null;
  }

  // Private helper that installs or upgrades the database
  static _upgrade(event) {
    const conn = event.target.result;
    if(!conn.objectStoreNames.contains('favicon-cache')) {
      conn.createObjectStore('favicon-cache', {
        'keyPath': 'pageURLString'
      });
    }
  }

  // Returns true if the age of the entry is greater than the maximum age
  static is_expired(entry, current_date, max_age = Favicon.MAX_AGE) {
    const age = current_date - entry.dateUpdated;
    return age > max_age;
  }

  // Searches for a cached entry in the favicon database
  // @param conn {IDBDatabase}
  // @param url {String}
  static find(conn, url) {
    return new Promise(function(resolve, reject) {
      const tx = conn.transaction('favicon-cache');
      const store = tx.objectStore('favicon-cache');
      const request = store.get(url);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Adds or replaces an entry in the cache
  // @param tx {IDBTransaction}
  // @param page_url {String}
  // @param icon_url {String}
  static add(tx, page_url, icon_url) {
    return new Promise(function(resolve, reject) {
      const entry = {'pageURLString': page_url, 'iconURLString': icon_url,
        'dateUpdated': new Date()};
      const store = tx.objectStore('favicon-cache');
      const request = store.put(entry);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  // Removes an entry from the cache database
  // @param tx {IDBTransaction}
  // @param page_url {String}
  static remove(tx, page_url) {
    return new Promise(function(resolve, reject) {
      const store = tx.objectStore('favicon-cache');
      const request = store.delete(page_url);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  // Looks for a <link> tag within an ancestor element
  // @param ancestor {Element}
  // @param selector {String}
  // @param base_url {URL}
  static match(ancestor, selector, base_url) {
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
    return null;
  }

  // TODO: just reject with an error
  // After a delay, resolve with a Response representing a timed out request
  static fetchTimeout(timeout) {
    return new Promise((resolve) => {
      const response = new Response('',
        {'status': 524, 'statusText': 'Request timed out'});
      setTimeout(resolve, timeout, response);
    });
  }

  // Fetches the html of the given url
  // @param url {String}
  // TODO: maybe I can avoid parsing and just search raw text for
  // <link> tags, the accuracy loss may be ok given the speed boost
  // TODO: use streaming text api, stop reading on </head>
  static async fetchDocument(url, timeout = 0) {
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
      promises.push(this.fetchTimeout(timeout));
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
      throw new Error(`Invalid document element ${url}`);
    return [doc, response.url];
  }

  // Sends a HEAD request for the given image. Ignores response body.
  // @param image_url {String}
  // @param timeout {Number}
  // @returns {Promise}
  static async fetchImageHead(url, timeout) {
    const opts = {};
    opts.credentials = 'omit'; // No cookies
    opts.method = 'HEAD';
    opts.headers = {'accept': 'image/*'};
    opts.mode = 'cors';
    opts.cache = 'default';
    opts.redirect = 'follow';
    opts.referrer = 'no-referrer';

    // Race a timeout with the fetch
    const promises = [fetch(url, opts)];
    if(timeout)
      promises.push(this.fetchTimeout(timeout));
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

    const type = response.headers.get('Content-Type');
    if(type && !/^\s*image\//i.test(type))
      throw new Error(`Invalid response type ${type}`);

    // Content-Length appears to be undefined for 304 or served from cache
    const len = response.headers.get('Content-Length');
    let len_int = -1;
    if(len) {
      try {
        len_int = parseInt(len, 10);
      } catch(error) {
      }
    }

    return {'image_size:': len_int, 'image_response_url': response.url};
  }

  // Deletes expired entries from the favicon cache database
  // @param conn {IDBDatabase}
  // @param log {console}
  // TODO: query for only expired entries rather than filter in memory
  static async compact(conn, log = Favicon.console) {
    log.debug('Compacting favicons in database', conn.name);
    const current_date = new Date();
    const tx = conn.transaction('favicon-cache', 'readwrite');
    const entries = await this.getAll(tx, log);
    const expired_entries = entries.filter((entry) =>
      this.is_expired(entry, current_date));
    const proms = expired_entries.map((entry) =>
      this.remove(tx, entry.pageURLString));
    const resolutions = await Promise.all(proms);
    log.debug('Deleted %d favicon entries', expired_entries.length);
    return expired_entries.length;
  }

  // Using the provided transaction, returns a promise that resolves to an array
  // of all favicon entries in the database
  // @param tx {IDBTransaction}
  // @param log {console}
  static getAll(tx, log) {
    return new Promise(function get_all_impl(resolve, reject) {
      log.debug('Getting all favicon entries');
      const store = tx.objectStore('favicon-cache');
      const request = store.getAll();
      request.onsuccess = function onsuccess(event) {
        const entries = event.target.result || [];
        log.debug('Got %d entries', entries.length);
        resolve(entries);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

Favicon.DB_NAME = 'favicon-cache';
Favicon.DB_VERSION = 1;
Favicon.MAX_AGE = 1000 * 60 * 60 * 24 * 30;
Favicon.console = {
  'debug': function(){},
  'log': function(){},
  'warn': function(){}
};

// Byte size limits
Favicon.MIN_SIZE = 49;
Favicon.MAX_SIZE = 10 * 1024 + 1;
