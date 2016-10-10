// See license.md

'use strict';

// Provides storage for memoizing lookups
function FaviconCache() {
  this.name = 'favicon-cache';
  this.version = 1;
  this.maxAge = 1000 * 60 * 60 * 24 * 30;
  this.log = SilentConsole;
}

FaviconCache.prototype.connect = function(onSuccess, onError) {
  this.log.log('Connecting to database', this.name, 'version', this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this._upgrade.bind(this);
  request.onsuccess = onSuccess;
  request.onerror = onError;
  request.onblocked = onError;
};

FaviconCache.prototype._upgrade = function(event) {
  this.log.log('Creating or upgrading database', this.name);
  const conn = event.target.result;
  if(!conn.objectStoreNames.contains('favicon-cache')) {
    conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
};

FaviconCache.prototype.isExpired = function(entry, maxAge) {
  const entryAge = new Date() - entry.dateUpdated;
  return entryAge >= maxAge;
};

FaviconCache.prototype.find = function(conn, url, callback) {
  this.log.log('FIND', url.href);
  const pageURLString = this.normalizeURL(url).href;
  const tx = conn.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = this._findOnSuccess.bind(this, url, callback);
  request.onerror = this._findOnError.bind(this, url, callback);
};

FaviconCache.prototype._findOnSuccess = function(url, callback, event) {
  if(event.target.result) {
    this.log.log('HIT', url.href, event.target.result.iconURLString);
  } else {
    this.log.log('MISS', url.href);
  }
  callback(event.target.result);
};

FaviconCache.prototype._findOnError = function(url, callback, event) {
  this.log.error(url.href, event.target.error);
  callback();
};

FaviconCache.prototype.add = function(conn, pageURL, iconURL) {
  const entry = {};
  entry.pageURLString = this.normalizeURL(pageURL).href;
  entry.iconURLString = iconURL.href;
  entry.dateUpdated = new Date();
  this.log.debug('Adding', entry);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
};

FaviconCache.prototype.remove = function(conn, pageURL) {
  const pageURLString = this.normalizeURL(pageURL).href;
  this.log.debug('Removing if exists', pageURLString);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(pageURLString);
};

FaviconCache.prototype.openCursor = function(conn, onSuccess, onError) {
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = onSuccess;
  request.onerror = onError;
};

FaviconCache.prototype.normalizeURL = function(url) {
  const clone = this.cloneURL(url);
  clone.hash = '';
  return clone;
};

FaviconCache.prototype.cloneURL = function(url) {
  return new URL(url.href);
};
