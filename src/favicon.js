// See license.md

'use strict';

class FaviconCache {

  constructor() {
    this.name = 'favicon-cache';
    this.version = 2;
    this.conn = null;
    this.maxAge = 1000 * 60 * 60 * 24 * 30;// 30d in ms default
  }

  // NOTE: requires ExtensionUtils
  static async createAlarm(periodInMinutes) {
    const alarm = await ExtensionUtils.getAlarm('compact-favicons');
    if(alarm)
      return;
    console.debug('Creating alarm compact-favicons');
    chrome.alarms.create('compact-favicons',
      {'periodInMinutes': periodInMinutes});
  }

  static registerAlarmListener() {
    chrome.alarms.onAlarm.addListener(FaviconCache.onAlarm);
  }

  static async onAlarm(alarm) {
    if(alarm.name === 'compact-favicons') {
      console.debug('Alarm wakeup', alarm.name);
      const fc = new FaviconCache();
      try {
        await fc.connect();
        await fc.compact();
      } catch(error) {
        console.warn(error);
      } finally {
        fc.close();
      }
    }
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

  // Concurrently issue remove requests using a shared transaction
  // Returns an array of the results of remove entry calls
  // @param urls {Array<String>} page urls to remove
  async removeAll(urls) {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const proms = urls.map((url) => this.remove(tx, url));
    return await Promise.all(proms);
  }

  async compact() {
    const expiredEntries = await this.getAllExpired();
    const expiredURLs = expiredEntries.map((e) => e.pageURLString);
    const resolutions = await this.removeAll(expiredURLs);
    return resolutions.length;
  }
}

class FaviconService {

  constructor() {
    this.cache = new FaviconCache();

    // By default send log messages to nowhere
    this.log = {
      'debug': function(){},
      'log': function(){},
      'warn': function(){},
      'error': function(){}
    };

    // Byte size ends points for images
    this.minSize = 49;
    this.maxSize = 10 * 1024 + 1;

    // Default timeouts for fetching
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

    // If redirected, add the response url to unique urls
    if(redirected)
      uniqURLs.push(responseURL.href);

    // If the fetch failed but we have an expired entry, remove it
    if(entry && !doc) {
      const tx = this.cache.conn.transaction('favicon-cache', 'readwrite');
      await this.cache.remove(tx, url.href);
    }

    const baseURLObject = redirected ? responseURL : url;
    const docIconURL = this.findIconInDocument(doc, baseURLObject);

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

    // If we did not find an in page icon, and we redirected, check cache for
    // redirect
    let redirectEntry;
    if(redirected)
      redirectEntry = await this.cache.find(responseURL.href);

    // If the redirect exists and is not expired, then resolve
    if(redirectEntry && !this.cache.isExpired(redirectEntry, currentDate))
      return redirectEntry.iconURLString;

    // If the origin is different from the request url and the redirect url,
    // then check the cache for the origin
    let originEntry;
    if(!uniqURLs.includes(url.origin)) {
      uniqURLs.push(url.origin);
      originEntry = await this.cache.find(url.origin);
    }

    // If an origin entry exists and is not expired, then update entries for the
    // other urls and resolve
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
    const rootImageURL = url.origin + '/favicon.ico';
    let imageSize, imageResponseURL;
    try {
      ({imageSize, imageResponseURL} = await this.fetchImageHead(rootImageURL));
    } catch(error) {
      this.log.warn(error);
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

  // Search for icon links in the document, and ensure the links are absolute.
  // Use the first valid link found.
  // TODO: use querySelectorAll?
  findIconInDocument(doc, baseURLObject) {
    const selectors = [
      'link[rel="icon"][href]',
      'link[rel="shortcut icon"][href]',
      'link[rel="apple-touch-icon"][href]',
      'link[rel="apple-touch-icon-precomposed"][href]'
    ];
    let docIconURL;

    if(!doc || !doc.head)
      return undefined;

    for(let selector of selectors) {
      docIconURL = this.match(doc.head, selector, baseURLObject);
      if(docIconURL)
        return docIconURL;
    }

    return undefined;
  }

  // Looks for a <link> tag within an ancestor element
  // @param ancestor {Element}
  // @param selector {String}
  // @param baseURLObject {URL}
  match(ancestor, selector, baseURLObject) {
    const element = ancestor.querySelector(selector);
    if(!element)
      return;
    const href = (element.getAttribute('href') || '').trim();
    // Without this check the URL constructor creates a clone of the base url
    if(!href)
      return;
    try {
      return new URL(href, baseURLObject);
    } catch(error) {
      this.log.warn(error);
    }
    return null;
  }

  // Rejects after a timeout
  fetchTimeout(url, timeout) {
    return new Promise((resolve, reject) => {
      setTimeout(reject, timeout, new Error(`Request timed out ${url}`));
    });
  }

  // Race a timeout against a fetch. fetch does not support timeout (yet?).
  // A timeout will not cancel/abort the fetch, but will ignore it.
  // A timeout rejection results in this throwing an uncaught error
  async fetch(url, options, timeout) {
    let response;
    if(timeout) {
      const promises = [
        fetch(url, options),
        this.fetchTimeout(url, timeout)
      ];
      response = await Promise.race(promises);
    } else {
      response = await fetch(url, opts);
    }
    return response;
  }

  // Fetches the html Document for the given url
  // @param url {String}
  // TODO: maybe I can avoid parsing and just search raw text for
  // <link> tags, the accuracy loss may be ok given the speed boost
  // TODO: use streaming text api, stop reading on </head>
  async fetchDocument(url) {
    const opts = {
      'credentials': 'omit',
      'method': 'get',
      'headers': {'Accept': 'text/html'},
      'mode': 'cors',
      'cache': 'default',
      'redirect': 'follow',
      'referrer': 'no-referrer'
    };

    const response = await this.fetch(url, opts, this.fetchHTMLTimeout);
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
  // @param url {String}
  // @returns {Promise}
  // Treat invalid content type as error
  // Treat unknown content type as valid
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

    const response = await this.fetch(url, opts, this.fetchImageTimeout);
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
        this.log.warn(error);
      }
    }

    return {'imageSize:': lenInt, 'imageResponseURL': response.url};
  }
}
