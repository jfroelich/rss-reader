// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Provides caching functionality to FaviconService

// NOTE: under heavy development, unstable
// TODO: do not use auto increment id. Use page url as keypath.

// Create a new cache instance with the given indexedDB database name
function FaviconCache(name) {
  this.name = name || 'favicon-cache';
  this.version = 1;
}

// Request a cache connection. Passes an event to the callback. If the type
// of the event is 'success', then the connection is event.target.result.
FaviconCache.prototype.connect = function(callback) {
  console.debug('Connecting to database', this.name, this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this.upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

// Private helper that handles setting up the database
FaviconCache.prototype.upgrade = function(event) {
  console.log('Upgrading database', this.name);

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

// Clears the contents of the database
FaviconCache.prototype.reset = function(callback) {
  console.log('Clearing database', this.name);

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

// Apply further normalizations to urls. Returns a new url object, does not
// modify its input.
FaviconCache.prototype.normalizeURL = function(url) {
  const outputURL = this.cloneURL(url);
  if(outputURL.hash) {
    outputURL.hash = '';
  }
  return outputURL;
};

// Creates a copy of a URL object
FaviconCache.prototype.cloneURL = function(url) {
  return new URL(url.href);
};

// Searches for an entry in the cache that matches the given url. Passes
// the result of the query as an event to the callback.
FaviconCache.prototype.findByPageURL = function(connection, url, callback) {
  console.debug('Finding', url.href);
  let pageURLString = this.normalizeURL(url).href;
  const transaction = connection.transaction('favicon-cache');
  const cacheStore = transaction.objectStore('favicon-cache');
  const urlIndex = cacheStore.index('page-url');
  const getRequest = urlIndex.get(pageURLString);
  getRequest.onsuccess = callback;
  getRequest.onerror = callback;
};

// Adds an entry to the cache
FaviconCache.prototype.addEntry = function(connection, pageURL,
  iconURL) {
  console.debug('Caching', pageURL.href, iconURL.href);
  const entry = Object.create(null);
  entry.pageURLString = this.normalizeURL(pageURL).href;
  entry.iconURLString = iconURL.href;
  entry.dateUpdated = new Date();
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.add(entry);
};

// Removes an entry from the cache
// TODO: test, i just wrote this without thinking or testing or anything
FaviconCache.prototype.deleteByPageURL = function(connection, pageURL) {
  console.debug('Deleting', pageURL.href);
  let pageURLString = this.normalizeURL(url).href;
  const transaction = connection.transaction('favicon-cache');
  const store = transaction.objectStore('favicon-cache');
  const urlIndex = cacheStore.index('page-url');
  const getRequest = urlIndex.openCursor(pageURLString);
  getRequest.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor && cursor.value) {
      cursor.delete();
    }
  };
};
