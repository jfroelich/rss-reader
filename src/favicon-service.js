// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// This is under heavy development. Do not use.

// TODO: review https://developer.mozilla.org/en-US/docs/Mozilla/Tech/
// XPCOM/Reference/Interface/mozIAsyncFavicons
// for inspiration

/*

favicons store schema:

var faviconpairing = {
  'domainString': 'http://www.example.com/',
  'faviconURLString': 'http://www.example.com/favicon.ico'
  'lastFetched': {Date object}
};

*/

class FaviconService {
  // Looks up the url of the associated favicon of the domain of the input
  // url and passes it to the callback. Passes back the default icon if an
  // error occurred. If the lookup is successful, the cache is updated.
  static lookup(inputURL, callback) {

    this.findFaviconByDomain(inputURL, onFindByDomain);

    function onFindByDomain(event) {

      if(event.type !== 'success') {
        // lookup error, do something like callback early and exit
        // unfinished
        return;
      }

      // The domain exists in the cache, pass the favicon url back
      if(event.target.result) {
        callback(match.faviconURLString);
        return;
      }

      // The url doesn't exist. Fetch it from google and store it
      queryGoogleFaviconService(inputURL, onQueryGoogle);
    }

    function onQueryGoogle(responseURL) {

      if(!responseURL) {
        // Google didn't return something useful. What do we do?
        // Unfinished
        return;
      }

      // Google found a favicon, store it and also return
      // TODO: this needs connection from somewhere
      // Do I wait for insert to complete and then callback or do i just
      // callback async?
      cacheLookup(connection, inputURL, responseURL);


      callback(responseURL);
    }
  }

  static cacheLookup(connection, inputURL, responseURL, callback) {

  }

  static findFaviconByDomain(inputURL, callback) {

    const domainString = inputURL.origin;

    db.open(onOpenDatabase);
    function onOpenDatabase(event) {
      if(event.type !== 'success') {
        callback();
        return;
      }

      const connection = event.target.result;
      const tx = connection.transaction('favicons');
      const store = tx.objectStore('favicons');
      const domainIndex = store.index('domain');
      const request = domainIndex.get(domainString);
      request.onsuccess = callback;
      request.onerror = callback;
    }
  }

  // Queries Google's favicon service
  static queryGoogleFaviconService(inputURL, callback) {

    const requestURLString = buildGoogleRequestURL(inputURL);

    const request = new XMLHttpRequest();
    request.timeout = 100;
    request.onerror = onResponse;
    request.ontimeout = onResponse;
    request.onabort = onResponse;
    request.onload = onResponse;
    const async = true;
    request.open('HEAD', requestURLString, async);
    request.send();

    function onResponse(event) {

      if(event.type !== 'load') {
        callback();
      }

      console.dir(event);

      const responseURLString = event.target.responseURL;
      const responseURL = new URL(responseURLString);
      callback(responseURL);
    }
  }

  static buildGoogleRequestURL(inputURL) {
    const baseURLString = 'http://www.google.com/s2/favicons?domain_url=';
    return baseURLString + encodeURIComponent(inputURL.href);
  }

  // Called when indexedDB's version is incremented. Responsible for setting
  // up the permanent storage and maintaining it.
  static onDatabaseUpgradeNeeded(event) {

    // Create the table if it does not exist
    const connection = event.target.result;
    const storeNames = connection.objectStoreNames;
    let store = null;
    if(storeNames.contains('favicons')) {
      store = event.target.transaction.objectStore('favicons');
    } else {
      store = connection.createObjectStore('favicons', {
        'keyPath': 'id',
        'autoIncrement': true
      });
    }

    const indices = store.indexNames;
    // Create the index if it does not exist
    if(!indices.contains('domain')) {
      store.createIndex('domain', 'domainString', {
        'unique': true
      });
    }
  }

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
