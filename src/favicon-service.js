// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function FaviconService(databaseName, fetchTimeoutMillis, isCacheless) {
  this.databaseName = databaseName || 'favicon-service';
  this.databaseVersion = 1;
  this.timeoutMillis = fetchTimeoutMillis;
  this.isCacheless = isCacheless;
}

FaviconService.prototype.resetCache = function(callback) {
  console.log('Resetting favicon service cache...');
  this._openDatabase(this._resetOnOpenDatabase.bind(this, callback));
};

// Looks up the associated icon url and passes it to the callback. If no icon
// is found, passes undefined to the callback.
FaviconService.prototype.lookup = function(url, callback) {

  if(this.isCacheless) {
    const connection = null;
    this._fetchDocument(url, callback, connection);
    return;
  }

  const onOpenDatabase = this._lookupOnOpenDatabase.bind(this, url, callback);
  this._openDatabase(onOpenDatabase);
};

///////////////////////
// PRIVATE FUNCTIONS

FaviconService.prototype._openDatabase = function(callback) {
  const request = indexedDB.open(this.databaseName, this.databaseVersion);
  request.onupgradeneeded = this._upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

FaviconService.prototype._upgrade = function(event) {
  console.log('Upgrading favicon service database', this.databaseName);

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

FaviconService.prototype._cacheEntry(connection, documentURL, iconURL) {

  const cacheEntry = Object.create(null);
  let pageURLString = null;
  if(documentURL.hash) {
    const noHash = this._cloneURL(documentURL);
    noHash.hash = '';
    pageURLString = noHash.href;
  } else {
    pageURLString = documentURL.href;
  }

  cacheEntry.pageURLString = pageURLString;
  cacheEntry.iconURLString = iconURL.href;

  console.debug('Storing url in favicon service cache: ',
    JSON.stringify(cacheEntry));

  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.add(cacheEntry);
};

FaviconService.prototype._resetOnOpenDatabase = function(callback, event) {
  if(event.type !== 'success') {
    callback(event);
    return;
  }

  const connection = event.target.result;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  transaction.oncomplete = callback;
  const cacheStore = transaction.objectStore('favicon-cache');
  cacheStore.clear();
  connection.close();
};

FaviconService.prototype._cloneURL = function(url) {
  // NOTE: there is no need for try catch because we know a parse exception
  // will not occur.
  return new URL(url.href);
};

// Upon connecting to the database, look for the url in the local cache,
// otherwise fetch it
FaviconService.prototype._lookupOnOpenDatabase = function(url, callback,
  event) {

  if(event.type !== 'success') {
    console.debug('Favicon service database connection error:', event);
    callback();
    return;
  }

  console.debug('Favicon service connected to database');

  let pageURLString = null;
  if(url.hash) {
    const noHash = this._cloneURL(url);
    noHash.hash = '';
    pageURLString = noHash.href;
  } else {
    pageURLString = url.href;
  }

  console.debug('Checking favicon service cache for page url',
    pageURLString);

  const connection = event.target.result;
  const transaction = connection.transaction('favicon-cache');
  const cacheStore = transaction.objectStore('favicon-cache');
  const urlIndex = cacheStore.index('page-url');
  const getRequest = urlIndex.get(pageURLString);

  const onFind = this._onFindByURL.bind(this, url, callback, connection);
  getRequest.onsuccess = onFind;
  getRequest.onerror = onFind;
};

FaviconService.prototype._onFindByURL = function(url, callback,
  connection, event) {

  if(event.type !== 'success') {
    connection.close();
    console.debug('Favicon service database query error:', event);
    callback();
    return;
  }

  const cacheEntry = event.target.result;

  if(cacheEntry) {
    connection.close();
    console.debug('Found favicon in cache:', JSON.stringify(cacheEntry));
    const iconURL = new URL(cacheEntry.iconURLString);
    callback(iconURL);
    return;
  }

  // If we did not find the url in the cache, investigate the page.
  this._fetchDocument(url, callback, connection);
};

FaviconService.prototype._fetchDocument = function(url, callback, connection) {
  console.debug('Favicon service is requesting', url.href);

  if('onLine' in navigator && !navigator.onLine) {
    console.warn('Cannot lookup favicon while offline');

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
  request.timeout = this.timeoutMillis;
  request.responseType = 'document';
  request.onerror = onFetch;
  request.ontimeout = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('GET', url.href, isAsync);
  request.send();
};

FaviconService.prototype._onFetchDocument = function(url, callback,
  connection, event) {

  if(event.type !== 'load') {
    console.debug('Favicon service failed to fetch page url', url.href);
    this._findIconInDomainRoot(url, callback, connection);
    return;
  }

  const document = event.target.responseXML;
  if(!document) {
    console.debug('Fetching %s resulted in an undefined document',
      url.href);
    this._findIconInDomainRoot(url, callback, connection);
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
    linkURL = this._selectURL(document, selectors[i], responseURL);
  }

  // TODO: add another fallback here maybe, look at all link urls for the
  // presence of the word 'favicon' (case insensitive)

  // TODO: if one of the urls is found, is it worth sending out another request
  // to verify the url is reachable?
  if(linkURL) {
    console.debug('Favicon service found in page icon url', linkURL.href);

    if(!this._isCacheless) {
      this._cacheEntry(connection, url, linkURL);
      connection.close();
    }

    callback(linkURL);
    return;
  }

  // Look for the icon in the root of the response url, not the input url,
  // in the event of a redirect
  this._findIconInDomainRoot(responseURL, callback, connection);
};

// TODO: instead of a function specifically for root, this should be a general
// function for any icon url, which the caller happens to use the path to the
// root for.
// TODO: see if while using a HEAD request I can get at the total bytes of the
// response. Then I can filter by minimum or maximum byte size as another type
// of way to reduce false positives.

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
FaviconService.prototype._selectURL = function(document, selector, baseURL) {
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
FaviconService.prototype._findIconInDomainRoot = function(url, callback,
  connection) {

  const onFetch = this._onFetchRootIcon.bind(this, url, callback, connection);
  const isAsync = true;

  // NOTE: origin does not include a trailing slash
  const requestURLString = url.origin + '/favicon.ico';

  console.debug('Favicon service checking for favicon in domain root',
    requestURLString);

  // TODO: is there a way to make this fail when requesting anything other
  // than an image? Like Accept-Content-Type or whatever?

  const request = new XMLHttpRequest();
  request.timeout = this.timeoutMillis;
  request.ontimeout = onFetch;
  request.onerror = onFetch;
  request.onabort = onFetch;
  request.onload = onFetch;
  request.open('HEAD', requestURLString, isAsync);
  request.send();
};

FaviconService.prototype._onFetchRootIcon = function(url, callback, connection,
  event) {

  if(event.type !== 'load') {

    // Either a 404 or something else
    console.debug('No icon found in domain root for', url.href);
    console.dir(event);

    if(connection) {
      connection.close();
    }

    callback();
    return;
  }

  // TODO: look at status code, maybe can restrict to 200?


  const type = event.target.getResponseHeader('Content-Type');

  console.debug('Root icon type:', type);

  // Try and avoid a false positive of a 404 page not returning 404
  //if(type && !type.indexOf('image/')) {
    // exit early ...
  //}

  const iconURL = new URL(event.target.responseURL);

  console.debug('Favicon service found favicon in root', iconURL.href);

  // TODO: this should be caching the domain url, not the page url, right?
  // In which case before fetching the root I should also be checking the
  // cache for the domain?

  if(!this.isCacheless) {
    this._cacheEntry(connection, url, iconURL);
    connection.close();
  }

  callback(iconURL);
};
