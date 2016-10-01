// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Provides storage for memoizing lookups
function FaviconCache() {
  this.name = 'favicon-cache';
  this.version = 1;
  this.maxAge = 1000 * 60 * 60 * 24 * 30;
  this.log = new LoggingService();
}

FaviconCache.prototype.connect = function(onSuccess, onError) {
  this.log.log('Connecting to database', this.name, 'version', this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this._upgrade.bind(this);
  request.onsuccess = onSuccess;
  request.onerror = onError;
  request.onblocked = onError;
};

FaviconCache.prototype._upgrade = function(event) {
  this.log.log('Creating or upgrading database', this.name);
  const conn = event.target.result;
  if(!conn.objectStoreNames.contains('favicon-cache')) {
    conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
};

FaviconCache.prototype.isExpired = function(entry, maxAge) {
  const entryAge = new Date() - entry.dateUpdated;
  return entryAge >= maxAge;
};

FaviconCache.prototype.find = function(conn, url, callback) {
  this.log.log('FIND', url.href);
  const pageURLString = this.normalizeURL(url).href;
  const tx = conn.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = this._findOnSuccess.bind(this, url, callback);
  request.onerror = this._findOnError.bind(this, url, callback);
};

FaviconCache.prototype._findOnSuccess = function(url, callback, event) {
  if(event.target.result) {
    this.log.log('HIT', url.href, event.target.result.iconURLString);
  } else {
    this.log.log('MISS', url.href);
  }
  callback(event.target.result);
};

FaviconCache.prototype._findOnError = function(url, callback, event) {
  this.log.error(url.href, event.target.error);
  callback();
};

FaviconCache.prototype.add = function(conn, pageURL, iconURL) {
  const entry = {};
  entry.pageURLString = this.normalizeURL(pageURL).href;
  entry.iconURLString = iconURL.href;
  entry.dateUpdated = new Date();
  this.log.debug('Adding', entry);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
};

FaviconCache.prototype.remove = function(conn, pageURL) {
  const pageURLString = this.normalizeURL(pageURL).href;
  this.log.debug('Removing if exists', pageURLString);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(pageURLString);
};

FaviconCache.prototype.openCursor = function(conn, onSuccess, onError) {
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = onSuccess;
  request.onerror = onError;
};

FaviconCache.prototype.normalizeURL = function(url) {
  const clone = this.cloneURL(url);
  clone.hash = '';
  return clone;
};

FaviconCache.prototype.cloneURL = function(url) {
  return new URL(url.href);
};

// Provides primarily a lookup function to find the favicon for a url
function FaviconService() {
  this.cache = new FaviconCache();
  this.log = new LoggingService();
  this.timeout = null;
  this.maxAge = this.cache.defaultMaxAge;
}

// @param url {URL} the web page to find a favicon for
// @param doc {Document} optional, prefetched document
// @param callback {function} callback receives icon url or undefined
FaviconService.prototype.lookup = function(url, doc, callback) {
  this.log.log('LOOKUP', url.href);

  const ctx = {
    'url': url,
    'callback': callback,
    'doc': doc,
    'db': null,
    'entry': null
  };

  this.cache.connect(this._connectOnSuccess.bind(this, ctx),
    this._connectOnError.bind(this, ctx));
};

FaviconService.prototype._connectOnSuccess = function(ctx, event) {
  this.log.log('Connected to favicon cache');
  ctx.db = event.target.result;
  if(ctx.doc) {
    const iconURL = this.searchDocument(ctx.doc, ctx.url);
    if(iconURL) {
      this.log.log('Found icon in prefetched doc', iconURL.href);
      this.cache.add(ctx.db, ctx.url, iconURL);
      return this._onLookupComplete(ctx, iconURL);
    }
  }

  this.cache.find(ctx.db, ctx.url, this._onFindRequestURL.bind(this, ctx));
};

FaviconService.prototype._connectOnError = function(ctx, event) {
  this.log.error(event.target.error);
  let iconURL;
  if(ctx.doc) {
    iconURL = this.searchDocument(ctx.doc, ctx.url);
  }
  this._onLookupComplete(ctx, iconURL);
};

FaviconService.prototype._onFindRequestURL = function(ctx, entry) {
  if(!entry) {
    return this._fetchDocument(ctx);
  }

  ctx.entry = entry;
  if(this.cache.isExpired(entry, this.maxAge)) {
    this.log.log('HIT (expired)', ctx.url.href);
    return this._fetchDocument(ctx);
  }

  const iconURL = new URL(entry.iconURLString);
  this._onLookupComplete(ctx, iconURL);
};

FaviconService.prototype._fetchDocument = function(ctx) {
  if('onLine' in navigator && !navigator.onLine) {
    this.log.debug('Offline');
    let iconURL;
    if(ctx.entry) {
      iconURL = new URL(ctx.entry.iconURLString);
    }
    this._onLookupComplete(ctx, iconURL);
    return;
  }

  this.log.log('GET', ctx.url.href);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = this._fetchDocumentOnError.bind(this, ctx);
  request.ontimeout = this._fetchDocumentOnTimeout.bind(this, ctx);
  request.onabort = this._fetchDocumentOnAbort.bind(this, ctx);
  request.onload = this._fetchDocumentOnSuccess.bind(this, ctx);
  request.open('GET', ctx.url.href, isAsync);
  request.setRequestHeader('Accept', 'text/html');
  request.send();
};

FaviconService.prototype._fetchDocumentOnAbort = function(ctx, event) {
  this.log.error(event.type, ctx.url.href);
  this._onLookupComplete(ctx);
};

FaviconService.prototype._fetchDocumentOnError = function(ctx, event) {
  this.log.error(event.type, ctx.url.href);
  if(ctx.entry) {
    this.cache.remove(ctx.db, ctx.url);
  }
  this._lookupOriginURL(ctx);
};

FaviconService.prototype._fetchDocumentOnTimeout = function(ctx, event) {
  this.log.debug(event.type, ctx.url.href);
  this._lookupOriginURL(ctx);
};

FaviconService.prototype._fetchDocumentOnSuccess = function(ctx, event) {
  this.log.debug('GOT', ctx.url.href);
  const responseURL = new URL(event.target.responseURL);
  if(responseURL.href !== ctx.url.href) {
    this.log.debug('REDIRECT', ctx.url.href, '>', responseURL.href);
  }

  const doc = event.target.responseXML;
  if(!doc) {
    this.log.debug('Undefined document', ctx.url.href);
    this._lookupRedirectURL(ctx, responseURL);
    return;
  }

  const iconURL = this.searchDocument(doc, responseURL);
  if(iconURL) {
    this.log.debug('Found icon in page', ctx.url.href, iconURL.href);
    this.cache.add(ctx.db, ctx.url, iconURL);
    if(responseURL.href !== ctx.url.href) {
      this.cache.add(ctx.db, responseURL, iconURL);
    }

    this._onLookupComplete(ctx, iconURL);
  } else {
    this.log.debug('No icon in fetched document', ctx.url.href);
    this._lookupRedirectURL(ctx, responseURL);
  }
};

FaviconService.prototype._lookupRedirectURL = function(ctx, redirectURL) {
  if(redirectURL && redirectURL.href !== ctx.url.href) {
    this.log.debug('Searching cache for redirect url', redirectURL.href);
    const onLookup = this._onLookupRedirectURL.bind(this, ctx, redirectURL);
    this.cache.find(ctx.db, redirectURL, onLookup);
  } else {
    this._lookupOriginURL(ctx, redirectURL);
  }
};

FaviconService.prototype._onLookupRedirectURL = function(ctx, redirectURL,
  entry) {
  if(entry && !this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Found non expired redirect url entry in cache',
      redirectURL.href);
    const iconURL = new URL(entry.iconURLString);
    this.cache.add(ctx.db, ctx.url, iconURL);
    this._onLookupComplete(ctx, iconURL);
  } else {
    this._lookupOriginURL(ctx, redirectURL);
  }
};

FaviconService.prototype._lookupOriginURL = function(ctx, redirectURL) {
  const originURL = new URL(ctx.url.origin);
  const originIconURL = new URL(ctx.url.origin + '/favicon.ico');
  if(this.isOriginDiff(ctx.url, redirectURL, originURL)) {
    this.log.debug('Searching cache for origin url', originURL.href);
    this.cache.find(ctx.db, originURL,
      this._onLookupOriginURL.bind(this, ctx, redirectURL));
  } else {
    this.sendImageHeadRequest(originIconURL,
      this._onFetchRootIcon.bind(this, ctx, redirectURL));
  }
};

FaviconService.prototype._onLookupOriginURL = function(ctx, redirectURL,
  entry) {
  if(entry && !this.cache.isExpired(entry, this.maxAge)) {
    this.log.debug('Found non-expired origin entry in cache',
      entry.pageURLString, entry.iconURLString);
    const iconURL = new URL(entry.iconURLString);
    if(ctx.url.href !== ctx.url.origin) {
      this.cache.add(ctx.db, ctx.url, iconURL);
    }

    if(ctx.url.origin !== redirectURL.href) {
      this.cache.add(ctx.db, redirectURL, iconURL);
    }

    this._onLookupComplete(ctx, iconURL);
  } else {
    const originIconURL = new URL(ctx.url.origin + '/favicon.ico');
    this.sendImageHeadRequest(originIconURL,
      this._onFetchRootIcon.bind(this, ctx, redirectURL));
  }
};

FaviconService.prototype._onFetchRootIcon = function(ctx, redirectURL,
  iconURLString) {
  const originURL = new URL(ctx.url.origin);

  if(iconURLString) {
    this.log.debug('Found icon at domain root', iconURLString);
    const iconURL = new URL(iconURLString);
    this.cache.add(ctx.db, ctx.url, iconURL);
    if(redirectURL && redirectURL.href !== ctx.url.href) {
      this.cache.add(ctx.db, redirectURL, iconURL);
    }
    if(this.isOriginDiff(ctx.url, redirectURL, originURL)) {
      this.cache.add(ctx.db, originURL, iconURL);
    }
    this._onLookupComplete(ctx, iconURL);
  } else {
    this.log.debug('FULL-FAIL', ctx.url.href);
    this.cache.remove(ctx.db, ctx.url);
    if(redirectURL && redirectURL.href !== ctx.url.href) {
      this.cache.remove(ctx.db, redirectURL);
    }
    if(this.isOriginDiff(ctx.url, redirectURL, originURL)) {
      this.cache.remove(ctx.db, originURL);
    }
    this._onLookupComplete(ctx);
  }
};

FaviconService.prototype._onLookupComplete = function(ctx, iconURLObject) {
  if(ctx.db) {
    this.log.debug('Requesting database to close');
    ctx.db.close();
  }

  ctx.callback(iconURLObject);
};

FaviconService.prototype.iconSelectors = [
  'link[rel="icon"][href]',
  'link[rel="shortcut icon"][href]',
  'link[rel="apple-touch-icon"][href]',
  'link[rel="apple-touch-icon-precomposed"][href]'
];

FaviconService.prototype.searchDocument = function(doc, baseURLObject) {
  if(doc.documentElement.localName !== 'html' || !doc.head) {
    this.log.debug('Document is not html or missing <head>',
        doc.documentElement.outerHTML);
    return;
  }

  // TODO: validate the url exists by sending a HEAD request for matches?
  for(let selector of this.iconSelectors) {
    const iconURL = this.matchSelector(doc, selector, baseURLObject);
    if(iconURL) {
      return iconURL;
    }
  }
};

FaviconService.prototype.matchSelector = function(ancestor, selector, baseURL) {
  const element = ancestor.querySelector(selector);
  if(!element) {
    return;
  }
  const href = (element.getAttribute('href') || '').trim();
  if(!href) {
    return;
  }
  try {
    return new URL(href, baseURL);
  } catch(error) {
    console.debug(error);
  }
};

FaviconService.prototype.isOriginDiff = function(pageURL, redirectURL,
  originURL) {
  return originURL.href !== pageURL.href &&
    (!redirectURL || redirectURL.href !== originURL.href);
};

FaviconService.prototype.sendImageHeadRequest = function(imgURL, callback) {
  const request = new XMLHttpRequest();
  const isAsync = true;
  const onResponse = this._onRequestImageHead.bind(this, imgURL, callback);
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  request.open('HEAD', imgURL.href, isAsync);
  request.setRequestHeader('Accept', 'image/*');
  request.send();
};

FaviconService.prototype._onRequestImageHead = function(imgURL, callback,
  event) {
  if(event.type !== 'load') {
    callback();
    return;
  }

  const response = event.target;
  const size = this.getImageSize(response);
  if(!this.isImageFileSizeInRange(size)) {
    callback();
    return;
  }

  const type = response.getResponseHeader('Content-Type');
  if(type && !this.isImageMimeType(type)) {
    callback();
    return;
  }

  callback(event.target.responseURL);
};

FaviconService.prototype.minImageSize = 49;
FaviconService.prototype.maxImageSize = 10001;

FaviconService.prototype.isImageFileSizeInRange = function(size) {
  return size > this.minImageSize && size < this.maxImageSize;
};

FaviconService.prototype.getImageSize = function(response) {
  const lenString = response.getResponseHeader('Content-Length');
  let lenInt = 0;
  if(lenString) {
    try {
      lenInt = parseInt(lenString, 10);
    } catch(error) {
      console.debug(error);
    }
  }

  return lenInt;
};

FaviconService.prototype.isImageMimeType = function(type) {
  return /^\s*image\//i.test(type);
};

// Runs in a separate 'thread', this looks for and deletes expired icons
// from the cache
function CompactFaviconsService() {
  this.cache = new FaviconCache();
  this.maxAge = this.cache.defaultMaxAge;
  this.log = new LoggingService();
}

CompactFaviconsService.prototype.start = function() {
  this.log.log('Compacting favicon cache, max age:', ctx.maxAge);
  this.cache.connect(this._connectOnSuccess.bind(this),
    this._connectOnError.bind(this));
};

CompactFaviconsService.prototype._connectOnSuccess = function(event) {
  this.log.debug('Connected to database');
  this.db = event.target.result;
  this.cache.openCursor(this.db,
    this._openCursorOnSuccess.bind(this),
    this._openCursorOnError.bind(this));
};

CompactFaviconsService.prototype._connectOnError = function(event) {
  this.log.error(event.target.error);
  this._onComplete();
};

CompactFaviconsService.prototype._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    return this._onComplete();
  }

  const entry = cursor.value;
  this.log.debug(entry.pageURLString, new Date() - entry.dateUpdated);

  if(this.cache.isExpired(entry, this.maxAge)) {
    this.log.log('Deleting', entry.pageURLString);
    cursor.delete();
  }

  cursor.continue();
};

CompactFaviconsService.prototype._openCursorOnError = function(event) {
  this.log.error(event.target.error);
  this._onComplete();
};

CompactFaviconsService.prototype._onComplete = function() {
  if(this.db) {
    this.log.debug('Requesting database be closed');
    this.db.close();
  }

  this.log.log('Finished compacting favicon cache');
};
