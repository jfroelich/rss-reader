// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Both args optional
function FaviconService(databaseName, fetchTimeoutMillis) {
  this.databaseName = databaseName || 'favicon-service';
  this.databaseVersion = 1;
  this.timeoutMillis = fetchTimeoutMillis;
}

// Resets the cache
FaviconService.prototype.reset = function(callback) {
  console.log('Resetting favicon service cache...');
  this._openDatabase(this._resetOnOpenDatabase.bind(this, callback));
};

// Looks up the associated icon and passes it to the callback
FaviconService.prototype.lookup = function(url, callback) {
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

  let pairsStore = null;
  if(stores.contains('url-pairs')) {
    pairsStore = transaction.objectStore('url-pairs');
  } else {
    pairsStore = connection.createObjectStore('url-pairs', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const indices = pairsStore.indexNames;
  if(!indices.contains('page-url')) {
    pairsStore.createIndex('page-url', 'pageURLString', {
      'unique': true
    });
  }
};

FaviconService.prototype._addPair(connection, documentURL, iconURL) {
  const pair = Object.create(null);
  let pageURLString = null;
  if(documentURL.hash) {
    const noHash = this._cloneURL(documentURL);
    noHash.hash = '';
    pageURLString = noHash.href;
  } else {
    pageURLString = documentURL.href;
  }

  pair.pageURLString = pageURLString;
  pair.iconURLString = iconURL.href;

  console.debug('Storing url in favicon service cache: ', JSON.stringify(pair));

  const transaction = connection.transaction('url-pairs', 'readwrite');
  const store = transaction.objectStore('url-pairs');
  store.add(pair);
};

FaviconService.prototype._resetOnOpenDatabase = function(callback,
  event) {
  if(event.type !== 'success') {
    callback(event);
    return;
  }

  const connection = event.target.result;
  const transaction = connection.transaction('url-pairs', 'readwrite');
  transaction.oncomplete = callback;
  const pairsStore = transaction.objectStore('url-pairs');
  pairsStore.clear();
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
  const transaction = connection.transaction('url-pairs');
  const pairsStore = transaction.objectStore('url-pairs');
  const urlIndex = pairsStore.index('page-url');
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

  const pair = event.target.result;

  if(pair) {
    connection.close();
    console.debug('Found favicon in cache:', JSON.stringify(pair));
    const iconURL = new URL(pair.iconURLString);
    callback(iconURL);
    return;
  }

  // If we did not find the url in the cache, investigate the page.
  if('onLine' in navigator && !navigator.onLine) {
    connection.close();
    console.warn('Cannot lookup favicon while offline');
    callback();
    return;
  }

  console.debug('Favicon service is requesting', url.href);

  // Request the remote document
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

  if(linkURL) {
    console.debug('Favicon service found in page icon url', linkURL.href);
    this._storePair(connection, url, linkURL);
    connection.close();
    callback(linkURL);
    return;
  }

  // Look for the icon in the root of the response url, not the input url,
  // in the event of a redirect
  this._findIconInDomainRoot(responseURL, callback, connection);
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
    connection.close();

    // Either a 404 or something else
    console.debug('No icon found in domain root for', url.href);
    console.dir(event);

    callback();
    return;
  }

  const iconURL = new URL(event.target.responseURL);

  console.debug('Favicon service found favicon in root', iconURL.href);

  this._addPair(connection, url, iconURL);
  connection.close();

  callback(iconURL);
};
