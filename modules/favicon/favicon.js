// See license.md

'use strict';

class FaviconCache {

  constructor() {
    this.name = 'favicon-cache';
    this.version = 1;
    this.conn = null;
    this.maxAge = 1000 * 60 * 60 * 24 * 30;// 30 days default
  }

  isExpired(entry, currentDate) {
    const age = currentDate - entry.dateUpdated;
    return age > this.maxAge;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = this._upgrade;
      request.onsuccess = () => resolve(this.conn = request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () => console.warn('Connection blocked');
    });
  }

  close() {
    if(this.conn)
      this.conn.close();
    else
      console.warn('this.conn undefined');
  }

  _upgrade(event) {
    const conn = event.target.result;
    if(!conn.objectStoreNames.contains('favicon-cache')) {
      conn.createObjectStore('favicon-cache', {
        'keyPath': 'pageURLString'
      });
    }
  }

  // @param url {String}
  find(url) {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('favicon-cache');
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
  add(tx, page_url, icon_url) {
    return new Promise((resolve, reject) => {
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
  remove(tx, page_url) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('favicon-cache');
      const request = store.delete(page_url);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  // Using the provided transaction, returns a promise that resolves to an array
  // of all favicon entries in the database
  // @param tx {IDBTransaction}
  // @param log {console}
  getAll(tx) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('favicon-cache');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}

class FaviconService {

  constructor() {

    this.cache = new FaviconCache();

    this.log = {
      'debug': function(){},
      'log': function(){},
      'warn': function(){}
    };

    // Byte size limits
    this.minSize = 49;
    this.maxSize = 10 * 1024 + 1;

    this.fetchHTMLTimeout = 500;
    this.fetchImageTimeout = 100;
  }

  async connect() {
    await this.cache.connect();
  }

  close() {
    this.cache.close();
  }

  // Given a url, lookup the associated favicon url. Tries to follow the spec by
  // first checking for the icon in the page, then checking in the domain root.
  // @param url {URL}
  // @returns {String} the icon url or null/undefined
  async lookup(url) {
    this.log.log('LOOKUP', url.href);
    const uniqURLs = [url.href];
    const currentDate = new Date();

    // Lookup the url in the cache
    const entry = await this.cache.find(url.href);
    if(entry && !this.cache.isExpired(entry, currentDate))
      return entry.iconURLString;

    // Check if we are online in order to fetch.
    // This helps distinguish network errors from 404s.
    if('onLine' in navigator && !navigator.onLine)
      return;

    // Fetch the html of the url. Fetch errors are non-fatal.
    let doc, responseURL;
    try {
      ({doc, responseURL} = await this.fetchDocument(url.href));
    } catch(error) {
      this.log.warn(error);
    }

    // If redirected, track the redirected url
    if(responseURL) {
      responseURL = new URL(responseURL);

      // TODO: this comparison isn't sufficient. The hash needs to be ignored
      // because response.url will be different merely because hash is stripped
      // but in reality no redirect occurred
      if(responseURL.href !== url.href)
        uniqURLs.push(responseURL.href);
    }

    // If the fetch failed but we have an entry, remove it because it is no
    // longer valid
    if(entry && !doc) {
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      await this.cache.remove(tx, url.href);
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
    let docIconURL;
    const baseURL = responseURL ? responseURL : url;
    if(doc && doc.head) {
      for(let selector of selectors) {
        docIconURL = this.match(doc.head, selector, baseURL);
        if(docIconURL)
          break;
      }
    }

    // If we found an in page icon, update the cache and resolve
    // TODO: can also store origin in cache if it distinct? would need to move
    // some origin url code upward
    if(docIconURL) {
      this.log.debug('Found favicon <link>', url.href, docIconURL.href);
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      const proms = uniqURLs.map((url) => this.cache.add(tx, url,
        docIconURL.href));
      await Promise.all(proms);
      return docIconURL.href;
    }

    // If redirected to different url, check cache for redirect
    let redirectEntry;
    if(uniqURLs.length > 1)
      redirectEntry = await this.cache.find(responseURL.href);

    // If the redirect url is in the cache, then resolve with that
    if(redirectEntry && !this.cache.isExpired(redirectEntry, currentDate))
      return redirectEntry.iconURLString;

    // Next, try checking if the origin url is in the cache if it is different
    // from the other urls
    let originEntry;
    if(!uniqURLs.includes(url.origin)) {
      uniqURLs.push(url.origin);
      originEntry = await this.cache.find(url.origin);
    }

    // If we found an origin entry, resolve with that
    if(originEntry && !this.cache.isExpired(originEntry, currentDate)) {
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      // Do not re-add the origin entry
      let proms = uniqURLs.filter((url)=> url !== url.origin);
      // Do add the url and possible redirect url, because those failed
      proms = proms.map((url) => this.cache.add(tx, url,
        originEntry.iconURLString));
      await Promise.all(proms);
      return originEntry.iconURLString;
    }

    // Fall back to checking domain root
    let imageSize, imageResponseURL;
    try {
      ({imageSize, imageResponseURL} = await this.fetchImageHead(
        url.origin + '/favicon.ico'));
    } catch(error) {
    }

    const sizeInRange = imageSize === -1 ||
      (imageSize > this.minSize && imageSize < this.maxSize);

    // If fetched and size is in range, then resolve to it
    if(imageResponseURL && sizeInRange) {
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      const proms = uniqURLs.map((url) => this.cache.add(tx, url,
        imageResponseURL));
      await Promise.all(proms);
      return imageResponseURL;
    }

    // Remove expired entries
    const expiredURLs = [];
    if(entry)
      expiredURLs.push(entry.pageURLString);
    if(redirectEntry)
      expiredURLs.push(redirectEntry.pageURLString);
    if(originEntry)
      expiredURLs.push(originEntry.pageURLString);
    if(expiredURLs.length) {

      // TODO: actually I don't really need to share a tx here, the requests
      // are independent. I can simplify cache.remove

      // TODO: if anything, I should be calling cache.removeAll and give it
      // an array of urls

      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      const proms = expiredURLs.map((url) => this.cache.remove(tx, url));
      await Promise.all(proms);
    }

    return null;
  }

  // Looks for a <link> tag within an ancestor element
  // @param ancestor {Element}
  // @param selector {String}
  // @param baseURL {URL}
  match(ancestor, selector, baseURL) {
    const element = ancestor.querySelector(selector);
    if(!element)
      return;
    const href = (element.getAttribute('href') || '').trim();
    // Without this check the URL constructor would not throw
    if(!href)
      return;
    try {
      return new URL(href, baseURL);
    } catch(error) {
      console.warn(error);
    }
    return null;
  }

  fetchTimeout(timeout) {
    return new Promise((_, reject) => {
      setTimeout(reject, timeout, new Error('Request timed out'));
    });
  }

  // Fetches the html of the given url
  // @param url {String}
  // TODO: maybe I can avoid parsing and just search raw text for
  // <link> tags, the accuracy loss may be ok given the speed boost
  // TODO: use streaming text api, stop reading on </head>
  async fetchDocument(url) {
    const opts = {};
    opts.credentials = 'omit';
    opts.method = 'GET';
    opts.headers = {'Accept': 'text/html'};
    opts.mode = 'cors';
    opts.cache = 'default';
    opts.redirect = 'follow';
    opts.referrer = 'no-referrer';

    let response;
    if(this.fetchHTMLTimeout) {
      const promises = [fetch(url, opts),
        this.fetchTimeout(this.fetchHTMLTimeout)];
      response = await Promise.race(promises);
    } else {
      response = await fetch(url, opts);
    }

    if(!response.ok)
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    if(response.status === 204)
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    const typeHeader = response.headers.get('Content-Type');
    if(!/^\s*text\/html/i.test(typeHeader))
      throw new Error(`Invalid content type "${typeHeader}" ${url}`);
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    if(doc.documentElement.localName.toLowerCase() !== 'html')
      throw new Error(`Invalid document element ${url}`);
    return {'doc': doc, 'responseURL': response.url};
  }

  // Sends a HEAD request for the given image. Ignores response body.
  // @param image_url {String}
  // @returns {Promise}
  // Treat invalid content typeHeader as error
  // Treat unknown content typeHeader as valid
  // TODO: maybe be more restrictive about allowed content typeHeader
  // image/vnd.microsoft.icon
  // image/png
  // image/x-icon
  // image/webp
  async fetchImageHead(url) {
    const opts = {};
    opts.credentials = 'omit'; // No cookies
    opts.method = 'HEAD';
    opts.headers = {'accept': 'image/*'};
    opts.mode = 'cors';
    opts.cache = 'default';
    opts.redirect = 'follow';
    opts.referrer = 'no-referrer';

    let response;
    if(this.fetchImageTimeout) {
      const promises = [fetch(url, opts),
        this.fetchTimeout(this.fetchImageTimeout)];
      response = await Promise.race(promises);
    } else {
      response = await fetch(url, opts);
    }

    // Treat non-network errors as fatal errors
    if(!response.ok)
      throw new Error(`${response.status} ${response.statusText} ${url}`);
    const typeHeader = response.headers.get('Content-Type');
    if(typeHeader && !/^\s*image\//i.test(typeHeader))
      throw new Error(`Invalid response type ${typeHeader}`);
    const lenHeader = response.headers.get('Content-Length');
    let lenInt = -1;
    if(lenHeader) {
      try {
        lenInt = parseInt(lenHeader, 10);
      } catch(error) {
      }
    }

    return {'imageSize:': lenInt, 'imageResponseURL': response.url};
  }

  // Deletes expired entries from the favicon cache database
  // @param conn {IDBDatabase}
  // @param log {console}
  // TODO: query for only expired entries rather than filter in memory
  async compact(conn) {
    const currentDate = new Date();
    const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
    const entries = await this.cache.getAll(tx, log);
    const expiredEntries = entries.filter((e) =>
      this.cache.isExpired(e, currentDate));
    const proms = expiredEntries.map((e) =>
      this.cache.remove(tx, e.pageURLString));
    const resolutions = await Promise.all(proms);
    return expiredEntries.length;
  }
}
