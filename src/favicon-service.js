// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function FaviconService() {
  this.timeout = null;
  this.cache = null;
}

// Looks up the associated icon url and passes it to the callback. If no icon
// is found, passes undefined to the callback.
FaviconService.prototype.lookup = function(url, callback) {
  if(this.cache) {
    this.cache.connect(this._lookupOnConnect.bind(this, url, callback));
  } else {
    this.fetchDocument(url, callback, null);
  }
};

FaviconService.prototype._lookupOnConnect = function(url, callback, event) {
  if(event.type !== 'success') {
    console.debug('Cache connection error:', event);
    callback();
    return;
  }

  console.debug('Connected to cache');
  const connection = event.target.connection;
  this.cache.findByPageURL(connection, url,
    this._onFindByURL.bind(this, url, callback, connection));
};

FaviconService.prototype._onFindByURL = function(url, callback, connection,
  event) {

  if(event.type !== 'success') {
    console.debug('Cache query error', event);
    connection.close();
    callback();
    return;
  }

  const entry = event.target.result;

  if(entry) {
    console.debug('Cache hit', entry.iconURLString);
    connection.close();
    const iconURL = new URL(entry.iconURLString);
    callback(iconURL);
    return;
  }

  console.debug('Cache miss for', url.href);
  this.fetchDocument(url, callback, connection);
};

FaviconService.prototype.fetchDocument = function(url, callback, connection) {
  console.debug('Fetching', url.href);

  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Fetch error: offline');

    // connection may be undefined when caching is disabled
    if(connection) {
      connection.close();
    }

    callback();
    return;
  }

  const onFetch = this._onFetchDocument.bind(this, url, callback, connection);
  const isAsync = true;
  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.responseType = 'document';
  request.onerror = onFetch;
  request.ontimeout = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('GET', url.href, isAsync);
  request.send();
};

FaviconService.prototype._onFetchDocument = function(url, callback, connection,
  event) {

  if(event.type !== 'load') {
    console.debug('Fetch error', event.type, url.href);
    this.findIconInDomainRoot(url, callback, connection);
    return;
  }

  const document = event.target.responseXML;
  if(!document) {
    console.debug('Fetch error: undefined document for',
      url.href);
    this.findIconInDomainRoot(url, callback, connection);
    return;
  }

  const responseURL = new URL(event.target.responseURL);

  // TODO: link elements can also have a type attribute that is a string
  // of the mime type. At the very least I can restrict to certain types or
  // blacklist some types if a type attribute is present. E.g. I can avoid
  // a stylesheet if someone used the wrong rel attribute value but the right
  // type value.

  const selectors = [
    'head > link[rel="icon"][href]',
    'head > link[rel="shortcut icon"][href]',
    'head > link[rel="apple-touch-icon"][href]',
    'head > link[rel="apple-touch-icon-precomposed"][href]'
  ];

  let linkURL = null;
  for(let i = 0, len = selectors.length; !linkURL && i < len; i++) {
    linkURL = this.findURLInPage(document, selectors[i], responseURL);
  }

  // TODO: add another fallback here maybe, look at all link urls for the
  // presence of the word 'favicon' (case insensitive)

  // TODO: if one of the urls is found, is it worth sending out another request
  // to verify the url is reachable?
  if(linkURL) {
    console.debug('Found in page url:', linkURL.href);

    if(this.cache) {
      this.cache.addEntry(connection, url, linkURL);
      connection.close();
    }

    callback(linkURL);
    return;
  }

  console.debug('Did not find in page icon url for', responseURL.href);

  // Look for the icon in the root of the response url, not the input url,
  // in the event of a redirect
  this.findIconInDomainRoot(responseURL, callback, connection);
};

// Searches for the favicon url in the contents of an HTML document, and if
// found and appears valid (no parsing errors), returns the absolute form of
// the url.
//
// This expects a base url object because the in document url may be relative.
// I did not check if whether the fact that urls can be relative is actually
// true in the spec, but I once observed it in some reference implementation I
// found. This returns the absolute form of the url. Using a URL object instead
// of a string also provides url normalization. Creating the url object here
// also minimizes the scope of the try/catch statement which otherwise causes a
// deoptimization.
FaviconService.prototype.findURLInPage = function(document, selector,
  baseURL) {

  let element = document.querySelector(selector);
  if(!element) {
    return;
  }

  let href = element.getAttribute('href');
  if(!href) {
    return;
  }

  href = href.trim();
  if(!href) {
    return;
  }

  try {
    return new URL(href, baseURL);
  } catch(exception) {}
};

// Send a HEAD request to check for the favicon.ico file
// TODO: instead of a function specifically for root, this should be a general
// function for any icon url, which the caller happens to use the path to the
// root for.
// TODO: see if while using a HEAD request I can get at the total bytes of the
// response. Then I can filter by minimum or maximum byte size as another type
// of way to reduce false positives.
FaviconService.prototype.findIconInDomainRoot = function(url, callback,
  connection) {

  const onFetch = this._onFindIconInDomainRoot.bind(this, url, callback,
    connection);
  const isAsync = true;

  const requestURLString = url.origin + '/favicon.ico';

  console.debug('Checking domain root', requestURLString);

  // TODO: is there a way to make this fail when requesting anything other
  // than an image? Like Accept-Content-Type or whatever?

  const request = new XMLHttpRequest();
  request.timeout = this.timeout;
  request.ontimeout = onFetch;
  request.onerror = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('HEAD', requestURLString, isAsync);
  request.send();
};


// TODO: look at status code, maybe can restrict to 200?
FaviconService.prototype._onFindIconInDomainRoot = function(url, callback,
  connection, event) {

  if(event.type !== 'load') {

    // Either a 404 or something else
    console.debug('No icon found in domain root for', url.href);
    console.dir(event);

    // Connection may be undefined if not caching
    if(connection) {
      connection.close();
    }

    callback();
    return;
  }

  const contentLengthString = event.target.getResponseHeader('Content-Length');
  console.debug('Icon content length:', contentLengthString);


  const type = event.target.getResponseHeader('Content-Type');
  console.debug('Root icon content type:', type);
  // Try and avoid a false positive of a 404 page not returning 404
  //if(type && !type.indexOf('image/')) {
    // exit early ...
  //}

  const iconURL = new URL(event.target.responseURL);

  console.debug('Found favicon in root', iconURL.href);

  // TODO: this should be caching the domain url, not the page url, right?
  // TODO: i should be checking the cache for the domain root as well before
  // even trying to fetch it.

  if(this.cache) {
    this.cache.addEntry(connection, url, iconURL);
    connection.close();
  }

  callback(iconURL);
};

///////////////////////////////////////////////

function FaviconDummyCache(name) {
  console.debug('Created dummy cache');
}

FaviconDummyCache.prototype.connect = function(callback) {
  console.debug('Opening connection to dummy cache');
  const event = {};
  event.type = 'success';
  event.target = {};
  event.target.connection = {};

  event.target.connection.close = function() {
    console.debug('Closing connection to dummy cache');
  };

  callback(event);
};

FaviconDummyCache.reset = function(callback) {
  console.debug('Resetting dummy cache');
  callback();
};

FaviconDummyCache.prototype.findByPageURL = function(connection, url,
  callback) {
  console.debug('Looking for page url in dummy cache', url.href);
  const event = {};
  event.type = 'success';
  event.target = {};
  event.target.result = {
    'pageURLString': 'http://www.google.com/',
    'iconURLString':
    'https://www.google.com/images/branding/product/ico/googleg_lodp.ico'
  };

  callback(event);
};

FaviconDummyCache.prototype.addEntry = function(connection, pageURL, iconURL) {
  console.debug('Adding entry to dummy cache', pageURL.href, iconURL.href);
};

///////////////////////////////////////////////

function FaviconServiceIndexedDBCache(name) {
  this.name = name || 'favicon-service-cache';
  this.version = 1;
}

FaviconServiceIndexedDBCache.prototype.cloneURL = function(url) {
  return new URL(url.href);
};

FaviconServiceIndexedDBCache.prototype.connect = function(callback) {
  console.debug('Connecting to indexedDB database', this.name, this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this.upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

FaviconServiceIndexedDBCache.prototype.upgrade = function(event) {
  console.log('Upgrading indexedDB database', this.name);

  const connection = event.target.result;
  const transaction = event.target.transaction;
  const stores = connection.objectStoreNames;

  let cacheStore = null;
  if(stores.contains('favicon-cache')) {
    cacheStore = transaction.objectStore('favicon-cache');
  } else {
    cacheStore = connection.createObjectStore('favicon-cache', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const indices = cacheStore.indexNames;
  if(!indices.contains('page-url')) {
    cacheStore.createIndex('page-url', 'pageURLString', {
      'unique': true
    });
  }
};

FaviconServiceIndexedDBCache.prototype.reset = function(callback) {
  console.log('Clearing indexedDB database', this.name);

  this.connect(function(event) {
    if(event.type !== 'success') {
      callback(event);
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    transaction.oncomplete = callback;
    const store = transaction.objectStore('favicon-cache');
    store.clear();
    connection.close();
  });
};

FaviconServiceIndexedDBCache.prototype.findByPageURL = function(connection,
  url, callback) {

  console.debug('Checking indexedDB for url', url.href);

  let pageURLString = null;
  if(url.hash) {
    const noHash = this.cloneURL(url);
    noHash.hash = '';
    pageURLString = noHash.href;
  } else {
    pageURLString = url.href;
  }

  const transaction = connection.transaction('favicon-cache');
  const cacheStore = transaction.objectStore('favicon-cache');
  const urlIndex = cacheStore.index('page-url');
  const getRequest = urlIndex.get(pageURLString);
  getRequest.onsuccess = callback;
  getRequest.onerror = callback;
};

FaviconServiceIndexedDBCache.prototype.addEntry = function(connection, pageURL,
  iconURL) {

  console.debug('Caching in indexedDB', pageURL.href, iconURL.href);

  const entry = Object.create(null);
  if(pageURL.hash) {
    const noHash = this.cloneURL(pageURL);
    noHash.hash = '';
    entry.pageURLString = noHash.href;
  } else {
    entry.pageURLString = pageURL.href;
  }
  entry.iconURLString = iconURL.href;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.add(entry);
};
