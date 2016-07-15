// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// This is under heavy development. Do not use.

// TODO: i should handle failure to find icon better. if not in db and cannot
// find online, then i should mark as missing icon, and later checks should
// not keep trying to fetch it until after some period of time.
// TODO: think more about using an expiration date so I can determine when
// i should try and update an existing pair in the database
// TODO: maybe have an option to always check for new remote icon and overwrite
// existing cached pairing.
// TODO: should i be storing pairs with the url, or just its origin? If just
// its origin, I should also only query by origin.
// Maybe I can store both originURLString and documentURLString, and decide
// at some other point in time?
// maybe have a parameter like 'useOrigin' that determines whether to use it
// TODO: maybe provide some way of allowing caller to provide the fetched
// document in order to avoid refetching when it is already available?

function FaviconService(databaseName, fetchTimeoutMillis) {
  this.databaseName = databaseName || 'favicon-service';
  this.databaseVersion = 1;

  // Allow the timeout to be undefined, which means this will defer to
  // the browser's own defaults
  this.timeoutMillis = fetchTimeoutMillis;
}

FaviconService.prototype._requestDatabaseConnection = function(callback) {
  const request = indexedDB.open(this.databaseName, this.databaseVersion);
  request.onupgradeneeded = this._onUpgradeNeeded;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

FaviconService.prototype.onUpgradeNeeded = function(event) {
  console.debug('Upgrading favicon database', this.databaseName);

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
  if(!indices.contains('document-url')) {
    pairsStore.createIndex('document-url', 'documentURLString', {
      'unique': true
    });
  }
};

FaviconService.prototype._addPair(connection, documentURL, iconURL) {

  // Create the object we will store
  const pair = Object.create(null);
  let documentURLString = null;
  if(documentURL.hash) {
    const noHash = this.cloneURL(documentURL);
    noHash.hash = '';
    documentURLString = noHash.href;
  } else {
    documentURLString = documentURL.href;
  }

  pair.documentURLString = documentURLString;
  pair.iconURLString = iconURL.href;

  const transaction = connection.transaction('url-pairs', 'readwrite');
  const store = transaction.objectStore('url-pairs');
  store.add(pair);
};

FaviconService.prototype.clearCache = function(callback) {
  this._requestDatabaseConnection(
    this._clearCacheOnConnect.bind(this, callback));
};

FaviconService._clearCacheOnConnect = function(callback, event) {
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

// TODO: research whether there is a simple way to clone a URL object. I don't
// like how this involves serialization and de-serialization.
// NOTE: there is no need for try catch because we know a parse exception
// will not occur.
FaviconService.cloneURL = function(url) {
  return new URL(url.href);
};

// Looks up the associated icon and passes it to the callback
// Based on spec: https://www.w3.org/TR/html5/links.html#rel-icon
FaviconService.prototype.getFavIconURL = function(url, callback) {

  // TODO: should i be doing the binding here or in _requestDatabaseConnection?
  // which practice is better?
  this._requestDatabaseConnection(onRequestDatabase.bind(this));

  function onRequestDatabase(event) {

    // 'this' is bound to the instance of the favicon service

    // If we cannot connect to the database then consider the whole service
    // to be unreliable and do not even bother looking online. Just exit.
    if(event.type !== 'success') {
      console.debug('Database connection error:', event);
      callback();
      return;
    }

    // Build the string which we will search for in the store
    let documentURLString = null;
    if(url.hash) {
      const noHash = this.cloneURL(url);
      noHash.hash = '';
      documentURLString = noHash.href;
    } else {
      documentURLString = url.href;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('url-pairs');
    const pairsStore = transaction.objectStore('url-pairs');
    const urlIndex = pairsStore.index('document-url');
    const getRequest = urlIndex.get(documentURLString);

    // Bind onFindByURL to this instance of the faviconservice and create
    // a partial function that includes connection as its first parameter
    const onFind = onFindByURL.bind(this, connection);
    getRequest.onsuccess = onFind;
    getRequest.onerror = onFind;
  }

  function onFindByURL(connection, event) {

    // If there is an actual database error, we shouldn't attempt to look
    // online or do anything at all. Just exit.
    if(event.type !== 'success') {
      connection.close();
      console.debug('Database query error:', event);
      callback();

      return;
    }

    const pair = event.target.result;

    // If we found the url in the cache, we are done.
    if(pair) {
      connection.close();
      console.debug('Found favicon in cache:', pair.documentURLString,
        pair.iconURLString);
      const iconURL = new URL(pair.iconURLString);
      callback(iconURL);
      return;
    }

    // If we did not find the url in the cache, investigate the contents of
    // the page.
    if('onLine' in navigator && !navigator.onLine) {
      connection.close();
      console.debug('Cannot lookup favicon while offline');
      callback();
      return;
    }

    const onFetch = onFetchDocument.bind(this, connection);
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
  }

  function onFetchDocument(connection, event) {

    // 'this' is bound to the instance of the favicon service, not the
    // XMLHttpRequest instance.

    // We failed to fetch the document. Fallback to looking at the root
    if(event.type !== 'load') {
      findIconInDomainRoot.call(this, connection);
      return;
    }

    const document = event.target.responseXML;

    // Document may be undefined for non-html pages (e.g. a pdf). Fallback
    // to looking at the root.
    if(!document) {
      findIconInDomainRoot.call(this, connection);
      return;
    }

    // Otherwise, we successfully fetched an HTML page. Now investigate its
    // contents.
    const baseURL = new URL(event.target.responseURL);

    const selectors = [
      'head > link[rel="icon"][href]',
      'head > link[rel="shortcut icon"][href]',
      'head > link[rel="apple-touch-icon"][href]',
      'head > link[rel="apple-touch-icon-precomposed"][href]'
    ];

    let linkURL = null;
    for(let i = 0, len = selectors.length; i < len; i++) {
      linkURL = this._selectURL(document, selectors[i], baseURL);
      if(linkURL) {
        break;
      }
    }

    if(linkURL) {
      // We found the favicon within the document
      // Store the pair of urls without waiting for it to complete.
      this._storePair(connection, url, linkURL);
      // It is perfectly ok to request this immediately despite the above
      // still pending, it implicitly waits for transactions to complete.
      connection.close();
      callback(linkURL);
      return;
    }

    // We didn't find a favicon url within the document. Investigate the
    // root of the domain.
    findIconInDomainRoot.call(this, connection);
  }

  function findIconInDomainRoot(connection) {

    // 'this' is bound to the favicon service

    // Create the callback as bound to this
    const onFetch = onFetchRootIcon.bind(this, connection);
    const isAsync = true;

    // NOTE: origin does not include a trailing slash
    const requestURLString = url.origin + '/favicon.ico';

    // We don't care about the actual binary image file, we just want to know
    // that it exists, so we use a HEAD request because it is significantly
    // more lightweight than GET.
    const requestMethodType = 'HEAD';

    const request = new XMLHttpRequest();
    request.timeout = this.timeoutMillis;
    request.ontimeout = onFetch;
    request.onerror = onFetch;
    request.onabort = onFetch;
    request.onload = onFetch;
    request.open(requestMethodType, requestURLString, isAsync);
    request.send();
  }

  function onFetchRootIcon(connection, event) {
    if(event.type !== 'load') {
      connection.close();

      // Either a 404 or something else
      console.debug('No icon found in domain root for', url.href);
      console.dir(event);

      callback();
      return;
    }

    const iconURL = new URL(event.target.responseURL);

    this._addPair(connection, url, iconURL);
    connection.close();

    callback(iconURL);
  }
};

// Expects a base url object because the in document url may be relative. I
// did not check if this is actually true in the spec, but I once observed it
// in some reference implementation I found. This returns the absolute form
// of the url. Using a URL object instead of a string also provides url
// normalization. Creating the url object here also minimizes the scope of the
// try/catch statement which otherwise causes a deoptimization.
FaviconService._selectURL = function(document, selector, baseURL) {
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

  const MINIMUM_LENGTH_OF_VALID_URL = 5;
  if(href.length < MINIMUM_LENGTH_OF_VALID_URL) {
    return;
  }


  try {
    return new URL(href, baseURL);
  } catch(exception) {
    // Ignored
  }
};
