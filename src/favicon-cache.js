// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class FaviconCache {

  constructor(name) {
    this.name = name || 'favicon-cache';
    this.version = 1;
  }

  connect(callback) {
    console.assert(this.name, 'Undefined database name');
    const request = indexedDB.open(this.name, this.version);
    request.onupgradeneeded = this.upgrade.bind(this);

    request.onsuccess = function(event) {
      console.debug('Connected to database', this.name);
      callback(event.target.result);
    }.bind(this);

    request.onerror = function(event) {
      console.error('Error connecting to', this.name, event);
      callback();
    }.bind(this);

    request.onblocked = function(event) {
      console.warn('Connection blocked', this.name, event);
      callback();
    }.bind(this);
  }

  upgrade(event) {
    console.log('Creating or upgrading database', this.name);
    const connection = event.target.result;
    if(!connection.objectStoreNames.contains('favicon-cache')) {
      connection.createObjectStore('favicon-cache', {
        'keyPath': 'pageURLString'
      });
    }
  }

  clear(callback) {
    console.debug('Clearing', this.name);
    this.connect(onConnect.bind(this));

    function onConnect(connection) {
      if(!connection) {
        const transaction = connection.transaction('favicon-cache',
          'readwrite');
        transaction.oncomplete = onComplete.bind(this);
        const store = transaction.objectStore('favicon-cache');
        store.clear();
        connection.close();
      } else {
        callback();
      }
    }

    function onComplete(event) {
      console.debug('Cleared database', this.name);
      callback();
    }
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
    console.debug('Searching for entry with url', pageURL.href);
    let pageURLString = this.normalizeURL(pageURL).href;
    const transaction = connection.transaction('favicon-cache');
    const store = transaction.objectStore('favicon-cache');
    const request = store.get(pageURLString);
    request.onsuccess = function(event) {
      console.debug('Found favicon entry', pageURL.href,
        event.target.result.iconURLString);
      callback(event.target.result);
    };
    request.onerror = function(event) {
      console.error('Error searching for entry', pageURL.href, event);
      callback();
    };
  }

  addEntry(connection, pageURL, iconURL) {
    const entry = {
      'pageURLString': this.normalizeURL(pageURL).href,
      'iconURLString': iconURL.href,
      'dateUpdated': new Date()
    };
    console.debug('Caching entry', entry);
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    const store = transaction.objectStore('favicon-cache');
    store.put(entry);
  }

  deleteByPageURL(connection, pageURL) {
    console.debug('Deleting entry', pageURL.href);
    let pageURLString = this.normalizeURL(pageURL).href;
    const transaction = connection.transaction('favicon-cache', 'readwrite');
    const store = transaction.objectStore('favicon-cache');
    const request = store.delete(pageURLString);
    request.onsuccess = function(event) {
      console.debug('Deleted entry', pageURL.href);
    };
    request.onerror = function(event) {
      console.error('Error deleting entry', event);
    };
  }
}
