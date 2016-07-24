// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FaviconCache {
  constructor(name) {
    this.name = name || 'favicon-cache';
    this.version = 1;
    this.log = new LoggingService();
  }

  connect(callback) {

    if(!this.name) {
      this.log.error('FaviconCache: undefined database name');
      callback();
      return;
    }

    this.log.debug('FaviconCache: connecting to database', this.name,
      this.version);

    const request = indexedDB.open(this.name, this.version);
    request.onupgradeneeded = this.upgrade.bind(this);

    request.onsuccess = function(event) {
      this.log.debug('FaviconCache: connected to', this.name);
      callback(event.target.result);
    }.bind(this);

    request.onerror = function(event) {
      this.log.error('FaviconCache: connection error', event);
      callback();
    };

    request.onblocked = function(event) {
      this.log.error('FaviconCache: connection blocked', event);
      callback();
    };
  }

  upgrade(event) {
    this.log.log('FaviconCache: creating or upgrading', this.name);
    const connection = event.target.result;
    if(!connection.objectStoreNames.contains('favicon-cache')) {
      connection.createObjectStore('favicon-cache', {
        'keyPath': 'pageURLString'
      });
    }
  }

  clear(callback) {
    this.log.debug('FaviconCache: clearing', this.name);

    this.connect(function onConnectForClear(event) {
      if(event.type !== 'success') {
        callback();
        return;
      }

      const connection = event.target.result;
      const transaction = connection.transaction('favicon-cache', 'readwrite');
      transaction.oncomplete = function(event) {
        this.log.debug('FaviconCache: cleared', this.name);
        callback();
      };
      const store = transaction.objectStore('favicon-cache');
      store.clear();
      connection.close();
    });
  }

  normalizeURL(url) {
    const outputURL = this.cloneURL(url);
    if(outputURL.hash) {
      outputURL.hash = '';
    }
    return outputURL;
  }

  cloneURL(url) {
    return new URL(url.href);
  }

  findByPageURL(connection, pageURL, callback) {
    this.log.debug('FaviconCache: searching for', pageURL.href);

    let pageURLString = this.normalizeURL(pageURL).href;
    const transaction = connection.transaction('favicon-cache');
    const store = transaction.objectStore('favicon-cache');
    const request = store.get(pageURLString);
    request.onsuccess = function(event) {
      callback(event.target.result);
    };
    request.onerror = function(event) {
      this.log.error('FaviconCache: search error', event);
      callback();
    };
  }

  addEntry(connection, pageURL, iconURL) {
    this.log.debug('FaviconCache: caching', pageURL.href, iconURL.href);
    const entry = {
      'pageURLString': this.normalizeURL(pageURL).href,
      'iconURLString': iconURL.href,
      'dateUpdated': new Date()
    };
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    const store = transaction.objectStore('favicon-cache');
    store.put(entry);
  }

  deleteByPageURL(connection, pageURL) {
    this.log.debug('FaviconCache: deleting', this.name, pageURL.href);
    let pageURLString = this.normalizeURL(pageURL).href;
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    const store = transaction.objectStore('favicon-cache');
    const request = store.delete(pageURLString);
    request.onsuccess = function(event) {
      this.log.debug('FaviconCache: deleted', pageURL.href);
    }.bind(this);
    request.onerror = function(event) {
      this.log.error('FaviconCache: delete error', event);
    }.bind(this);
  }
}
