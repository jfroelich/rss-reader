// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.favicon = rdr.favicon || {};
rdr.favicon.cache = {};

// Default expiration period of 30 days in milliseconds
rdr.favicon.cache.expires = 1000 * 60 * 60 * 24 * 30;
rdr.favicon.cache.dbName = 'favicon-cache';
rdr.favicon.cache.dbVersion = 1;

rdr.favicon.cache.connect = function(onSuccess, onError) {
  const request = indexedDB.open(rdr.favicon.cache.dbName,
    rdr.favicon.cache.dbVersion);
  request.onupgradeneeded = rdr.favicon.cache._upgrade;
  request.onsuccess = onSuccess;
  request.onerror = onError;
  request.onblocked = onError;
};

rdr.favicon.cache._upgrade = function(event) {
  console.log('Creating/upgrading db', rdr.favicon.cache.dbName, 'version',
    rdr.favicon.cache.dbVersion);
  const db = event.target.result;
  if(!db.objectStoreNames.contains('favicon-cache')) {
    db.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
};

// Returns true if the entry is older than or equal to the expiration period
rdr.favicon.cache.isExpired = function(entry, expires) {
  // Subtracting two dates yields the difference in ms
  const age = new Date() - entry.dateUpdated;
  return age >= expires;
};

rdr.favicon.cache.find = function(db, url, callback) {
  const cache = rdr.favicon.cache;
  const pageURLString = cache.normalizeURL(url).href;
  const tx = db.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = cache._findOnSuccess.bind(null, callback);
  request.onerror = cache._findOnError.bind(null, callback);
};

rdr.favicon.cache._findOnSuccess = function(callback, event) {
  callback(event.target.result);
};

rdr.favicon.cache._findOnError = function(callback, event) {
  console.error(event.target.error);
  callback();
};

rdr.favicon.cache.add = function(db, pageURL, iconURL) {
  const entry = {};
  entry.pageURLString = rdr.favicon.cache.normalizeURL(pageURL).href;
  entry.iconURLString = iconURL.href;
  entry.dateUpdated = new Date();
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
};

rdr.favicon.cache.remove = function(db, pageURL) {
  const pageURLString = rdr.favicon.cache.normalizeURL(pageURL).href;
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(pageURLString);
};

rdr.favicon.cache.openCursor = function(db, onsuccess, onerror) {
  const tx = db.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = onsuccess;
  request.onerror = onerror;
};

rdr.favicon.cache.normalizeURL = function(urlObject) {
  const outputURL = rdr.favicon.cache.cloneURL(urlObject);
  outputURL.hash = '';
  return outputURL;
};

rdr.favicon.cache.cloneURL = function(urlObject) {
  return new URL(urlObject.href);
};
