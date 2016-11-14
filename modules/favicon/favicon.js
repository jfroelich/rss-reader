// See license.md

'use strict';

class FaviconCache {

  constructor() {
    this.name = 'favicon-cache';
    this.version = 2;
    this.conn = null;
    this.maxAge = 1000 * 60 * 60 * 24 * 30;// 30d in ms default
  }

  isExpired(entry, currentDate) {
    const age = currentDate - entry.dateUpdated;
    return age > this.maxAge;
  }

  connect() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = this.upgrade;
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

  upgrade(event) {
    const conn = event.target.result;
    const tx = event.target.transaction;

    let faviconCacheStore;
    if(!event.oldVersion || event.oldVersion < 1) {
      console.debug('Creating favicon-cache object store');
      faviconCacheStore = conn.createObjectStore('favicon-cache', {
        'keyPath': 'pageURLString'
      });
    } else {
      faviconCacheStore = tx.objectStore('favicon-cache');
    }

    if(event.oldVersion < 2) {
      console.debug('Created index on dateUpdated');
      faviconCacheStore.createIndex('dateUpdated', 'dateUpdated');
    }
  }

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
  put(tx, pageURL, iconURL) {
    return new Promise((resolve, reject) => {
      const entry = {'pageURLString': pageURL, 'iconURLString': iconURL,
        'dateUpdated': new Date()};
      const store = tx.objectStore('favicon-cache');
      const request = store.put(entry);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  remove(tx, pageURL) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('favicon-cache');
      const request = store.delete(pageURL);
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    });
  }

  getAll() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('favicon-cache');
      const store = tx.objectStore('favicon-cache');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getAllExpired() {
    return new Promise((resolve, reject) => {
      let cutoffTime = Date.now() - this.maxAge;
      cutoffTime = cutoffTime < 0 ? 0 : cutoffTime;
      const tx = this.conn.transaction('favicon-cache');
      const store = tx.objectStore('favicon-cache');
      const index = store.index('dateUpdated');
      const range = IDBKeyRange.upperBound(new Date(cutoffTime));
      const request = index.getAll(range);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(request.error);
    });
  }

  // Returns an array of the results of remove entry calls
  // @param urls {Array<String>} page urls to remove
  async removeAll(urls) {
    // Concurrently issue remove requests using a shared transaction
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const proms = urls.map((url) => this.remove(tx, url));
    return await Promise.all(proms);
  }

  async compact() {
    const expiredEntries = await this.getAllExpired();
    console.debug('Found %d expired entries', expiredEntries.length);
    const expiredURLs = expiredEntries.map((e) => e.pageURLString);
    const resolutions = await this.removeAll(expiredURLs);
    return resolutions.length;
  }
}

class FaviconService {

  constructor() {
    this.cache = new FaviconCache();

    // By default send messages to nowhere
    this.log = {
      'debug': function(){},
      'log': function(){},
      'warn': function(){}
    };

    // Byte size ends points for images
    this.minSize = 49;
    this.maxSize = 10 * 1024 + 1;

    this.fetchHTMLTimeout = 1000;
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

    // If we did not find a cached entry, or if we found a cached entry but it
    // is expired, then plan on fetching. Before fetching, check if we are
    // offline so as to distinguish offline from other fetch errors.
    if('onLine' in navigator && !navigator.onLine)
      return;

    // Fetch the html of the url. Fetch errors are non-fatal.
    let doc, responseURL, redirected = false;
    try {
      ({doc, responseURL, redirected} = await this.fetchDocument(url.href));
      responseURL = new URL(responseURL);
    } catch(error) {
      this.log.warn(error, url.href);
    }

    // If redirected, add the normalized response url to unique urls
    if(redirected)
      uniqURLs.push(responseURL.href);

    // If the fetch failed but we have an expired entry, remove it
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
    const baseURL = redirected ? responseURL : url;
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
      const proms = uniqURLs.map((url) => this.cache.put(tx, url,
        docIconURL.href));
      await Promise.all(proms);
      return docIconURL.href;
    }

    // If redirected, check cache for redirect
    let redirectEntry;
    if(redirected)
      redirectEntry = await this.cache.find(responseURL.href);

    // If redirected and the redirect url is in the cache and not expired,
    // then done
    if(redirectEntry && !this.cache.isExpired(redirectEntry, currentDate))
      return redirectEntry.iconURLString;

    // Next, try checking if the origin url is in the cache if it is different
    // from the other urls
    let originEntry;
    if(!uniqURLs.includes(url.origin)) {
      uniqURLs.push(url.origin);
      originEntry = await this.cache.find(url.origin);
    }

    // If we found an origin entry, resolve with that. Before returning, add the
    // url and the response url (if redirected) to the cache
    if(originEntry && !this.cache.isExpired(originEntry, currentDate)) {
      const iconURL = originEntry.iconURLString;
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      if(redirected) {
        const urls = [url.href, responseURL.href];
        const proms = proms.map((url) => this.cache.put(tx, url, iconURL));
        await Promise.all(proms);
      } else {
        await this.cache.put(tx, url.href, iconURL);
      }

      return iconURL;
    }

    // Fall back to checking domain root
    let imageSize, imageResponseURL;
    try {
      const rootImageURL = url.origin + '/favicon.ico';
      ({imageSize, imageResponseURL} = await this.fetchImageHead(rootImageURL));
    } catch(error) {
    }

    const sizeInRange = imageSize === -1 ||
      (imageSize > this.minSize && imageSize < this.maxSize);

    // If fetched and size is in range, then resolve to it
    if(imageResponseURL && sizeInRange) {
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      const proms = uniqURLs.map((url) => this.cache.put(tx, url,
        imageResponseURL));
      await Promise.all(proms);
      return imageResponseURL;
    }

    // Remove entries we know that exist but are expired
    const expiredURLs = [];
    if(entry)
      expiredURLs.push(entry.pageURLString);
    if(redirectEntry)
      expiredURLs.push(redirectEntry.pageURLString);
    if(originEntry)
      expiredURLs.push(originEntry.pageURLString);
    await this.cache.removeAll(expiredURLs);
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

    // Determine if a redirect occurred. Compare after removing the hash,
    // because the case where response url differs from the request url only
    // because of the hash is not actually a redirect.
    const urlo = new URL(url);
    urlo.hash = '';
    const redirected = urlo.href !== response.url;

    return {'doc': doc, 'responseURL': response.url, 'redirected': redirected};
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
}
