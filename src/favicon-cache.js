// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function FaviconCache(name) {
  this.name = name || 'favicon-cache';
  this.version = 1;
  this.log = new DummyLoggingService();
}

// Request a cache connection. Passes the connection to the callback. If an
// error occurs, passes back undefined.
FaviconCache.prototype.connect = function(callback) {
  this.log.debug('Connecting to database', this.name, this.version);

  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this.upgrade.bind(this);

  request.onsuccess = function(event) {
    this.log.debug('Connected to favicon cache database', this.name);
    callback(event.target.result);
  }.bind(this);

  request.onerror = function(event) {
    this.log.debug('Cache connection error', event);
    callback();
  };

  request.onblocked = function(event) {
    this.log.debug('Cache connection blocked', event);
    callback();
  };
};

FaviconCache.prototype.upgrade = function(event) {
  this.log.log('Creating or upgrading favicon cache database', this.name);
  const connection = event.target.result;
  if(!connection.objectStoreNames.contains('favicon-cache')) {
    connection.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
};

FaviconCache.prototype.clear = function(callback) {
  this.log.debug('Clearing favicon cache', this.name);

  this.connect(function onConnectForClear(event) {
    if(event.type !== 'success') {
      callback();
      return;
    }

    const connection = event.target.result;
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    transaction.oncomplete = function(event) {
      this.log.debug('Cleared favicon cache', this.name);
      callback();
    };
    const store = transaction.objectStore('favicon-cache');
    store.clear();
    connection.close();
  });
};

// Creates a new URL object that is a transformation of the input where the
// the url has been normalized.
FaviconCache.prototype.normalizeURL = function(url) {
  const outputURL = this.cloneURL(url);
  if(outputURL.hash) {
    outputURL.hash = '';
  }
  return outputURL;
};

// Creates a copy of a URL object.
FaviconCache.prototype.cloneURL = function(url) {
  return new URL(url.href);
};

// Searches for an entry in the cache that matches the given url. Passes
// the result to the callback. If no match or error, passes back undefined.
FaviconCache.prototype.findByPageURL = function(connection, pageURL, callback) {
  this.log.debug('Searching favicon cache for', pageURL.href);

  let pageURLString = this.normalizeURL(pageURL).href;
  const transaction = connection.transaction('favicon-cache');
  const store = transaction.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
  request.onerror = function(event) {
    this.log.error('Error searching favicon cache', event);
    callback();
  };
};

FaviconCache.prototype.addEntry = function(connection, pageURL, iconURL) {
  this.log.debug('Caching', pageURL.href, iconURL.href);
  const entry = {
    'pageURLString': this.normalizeURL(pageURL).href,
    'iconURLString': iconURL.href,
    'dateUpdated': new Date()
  };
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  store.put(entry);
};

FaviconCache.prototype.deleteByPageURL = function(connection, pageURL) {
  this.log.debug('Deleting from favicon cache', this.name, pageURL.href);
  let pageURLString = this.normalizeURL(pageURL).href;
  const transaction = connection.transaction('favicon-cache', 'readwrite');
  const store = transaction.objectStore('favicon-cache');
  const request = store.delete(pageURLString);
  request.onsuccess = function(event) {
    this.log.debug('Deleted', pageURL.href);
  }.bind(this);
  request.onerror = function(event) {
    this.log.debug('Error deleting', pageURL.href, event);
  }.bind(this);
};
