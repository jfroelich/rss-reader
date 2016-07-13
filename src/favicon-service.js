// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// This is under heavy development. Do not use.
// Based on spec: https://www.w3.org/TR/html5/links.html#rel-icon

const FaviconService = Object.create(null);


// TODO: maybe I should make this fully independent of the other database? that
// way this is basically a standalone module, completely independent, which
// might be a nice thing. the only issue i can think of is whether multiple
// databases per local origin are supported by various platforms.

// TODO: i should handle failure to find icon better. if not in db and cannot
// find online, then i should mark as missing icon, and later checks should
// not keep trying to fetch it until after some period of time.
// TODO: think more about using an expiration date so I can determine when
// i should try and update an existing pair in the database
// TODO: maybe have an option to always check for new remote icon and overwrite
// existing cached pairing.
// TODO: should i be storing pairs with the url, or just its origin? If just
// its origin, I should also only query by origin. Think about it more.
// Maybe I can store both originURLString and documentURLString, and decide
// at some other point in time?
// TODO: provide a function that clears the cache
// TODO: consider making connection optional so callers do not need to be
// concerned with it. The only case where I think it might be needed is in
// findIconURLByDocumentURL where the caller may plan to make multiple calls
// in which case opening a connection per call seems like a waste.


FaviconService.getFavIconURL = function(connection, url, callback) {

  FaviconService.findIconURLByDocumentURL(connection, url, onFindByURL);

  function onFindByURL(event) {
    if(event.type !== 'success') {
      // Query error
      console.debug(event);
      callback();
      return;
    }

    const matchingPair = event.target.result;

    if(matchingPair && matchingPair.iconURLString) {
      const iconURLString = matchingPair.iconURLString;
      const iconURL = new URL(iconURLString);
      callback(iconURL);
      return;
    }

    // If we are not online, we cannot check
    if('onLine' in navigator && !navigator.onLine) {
      console.debug('Offline');
      callback();
      return;
    }

    const request = new XMLHttpRequest();
    request.timeout = 5000;
    request.responseType = 'document';
    request.onerror = onFetchDocument;
    request.ontimeout = onFetchDocument;
    request.onabort = onFetchDocument;
    request.onload = onFetchDocument;
    const async = true;
    request.open('GET', url.href, async);
    request.send();
  }

  function onFetchDocument(event) {
    if(event.type !== 'load') {
      console.dir(event);
      callback();
      return;
    }

    const document = event.target.responseXML;

    if(!document) {
      console.dir(event);
      callback();
      return;
    }

    const responseURL = new URL(event.target.responseURL);

    const linkURL = FaviconService.findFaviconLink(document, responseURL);
    if(linkURL) {

      // TODO: store the new pair

      callback(linkURL);
      return;
    }

    FaviconService.requestFaviconRoot(url, onRequestRoot);
  }

  function onRequestRoot(iconURL) {

    if(iconURL) {

      // TODO: store the new pair

      callback(iconURL);
      return;
    }

    callback();
  }
};

FaviconService.findFaviconLink = function(document, baseURL) {
  const selectors = [
    'head > link[rel="icon"][href]',
    'head > link[rel="shortcut icon"][href]',
    'head > link[rel="apple-touch-icon"][href]',
    'head > link[rel="apple-touch-icon-precomposed"][href]'
  ];

  const selectURL = FaviconService.selectURL;

  for(let i = 0, len = selectors.length; i < len; i++) {
    let linkURL = selectURL(document, baseURL, selectors[i]);
    if(linkURL) {
      return linkURL;
    }
  }
};

// Looks at the href attribute value for the element matching the selector.
// If found, returns the absolute url.
FaviconService.selectURL = function(document, baseURL, selector) {
  let element = document.querySelector(selector);
  if(element) {
    let href = element.getAttribute('href');
    if(href && href.trim()) {
      try {
        return new URL(href, baseURL);
      } catch(exception) {
        console.debug(exception);
      }
    }
  }

  return null;
};

FaviconService.requestFaviconRoot = function(url, callback) {
  const request = new XMLHttpRequest();
  request.timeout = 1000;
  request.ontimeout = onResponse;
  request.onerror = onResponse;
  request.onabort = onResponse;
  request.onload = onResponse;
  const async = true;
  request.open('HEAD', url.origin + '/favicon.ico', async);
  request.send();

  function onResponse(event) {
    if(event.type !== 'load') {
      callback();
      return;
    }

    const responseURL = new URL(event.target.responseURL);
    callback(responseURL);
  }
};

FaviconService.findIconURLByDocumentURL = function(connection, documentURL,
  callback) {
  const transaction = connection.transaction('icon-store');
  const iconStore = transaction.objectStore('icon-store');
  const urlIndex = iconStore.index('document-url');
  const getRequest = urlIndex.get(documentURL.href);
  getRequest.onsuccess = callback;
  getRequest.onerror = callback;
};

FaviconService.addIconPair = function(connection, documentURL, iconURL,
  callback) {

  const pair = Object.create(null);
  pair.documentURLString = documentURL.href;
  pair.iconURLString = iconURL.href;

  const transaction = connection.transaction('icon-store', 'readwrite');
  const iconStore = transaction.objectStore('icon-store');
  const addRequest = iconStore.add(pair);
  addRequest.onsuccess = callback;
  addRequest.onerror = callback;
};

FaviconService.onDatabaseUpgradeNeeded = function(event) {
  const connection = event.target.result;
  const transaction = event.target.transaction;
  const stores = connection.objectStoreNames;

  let iconStore = null;
  if(stores.contains('icon-store')) {
    iconStore = transaction.objectStore('icon-store');
  } else {
    iconStore = connection.createObjectStore('icon-store', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const indices = iconStore.indexNames;
  if(!indices.contains('document-url')) {
    iconStore.createIndex('document-url', 'documentURLString', {
      'unique': true
    });
  }
};



/*
class FaviconService {



  // Asynchronous. Removes any cached urls from the database. Calls the
  // callback when complete.
  static clearCache(callback) {
    db.open(onOpenDatabase);
    function onOpenDatabase(event) {
      if(event.type !== 'success') {
        return;
      }

      const connection = event.target.result;
      const tx = connection.transaction('favicons', 'readwrite');
      tx.oncomplete = callback;
      const store = tx.objectStore('favicons');
      store.clear();
    }
  }
}
*/
