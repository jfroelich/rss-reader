// See license.md

'use strict';

// Provides storage for memoizing favicon lookups
class FaviconCache {

constructor(log) {
  this.name = 'favicon-cache';
  this.version = 1;
  this.maxAge = 1000 * 60 * 60 * 24 * 30;
  this.log = log || SilentConsole;
}

// TODO: need to properly react to blocked event similar to FeedDb

connect(onSuccess, onError) {
  this.log.log('Connecting to database', this.name, 'version', this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this._upgrade.bind(this);
  request.onsuccess = onSuccess;
  request.onerror = onError;
  request.onblocked = onError;
}

_upgrade(event) {
  this.log.log('Creating or upgrading database', this.name);
  const conn = event.target.result;
  if(!conn.objectStoreNames.contains('favicon-cache')) {
    conn.createObjectStore('favicon-cache', {
      'keyPath': 'pageURLString'
    });
  }
}

isExpired(entry, maxAge) {
  const entryAge = new Date() - entry.dateUpdated;
  return entryAge >= maxAge;
}

find(conn, url, callback) {
  this.log.log('Checking favicon cache for page url', url.href);
  const pageURLString = this.normalizeURL(url).href;
  const tx = conn.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(pageURLString);
  request.onsuccess = this._findOnSuccess.bind(this, url, callback);
  request.onerror = this._findOnError.bind(this, url, callback);
}

_findOnSuccess(url, callback, event) {
  const result = event.target.result;
  if(result) {
    this.log.log('Found icon url %s in cache for url %s', result.iconURLString,
      url.href);
  } else {
    this.log.log('Did not find icon in cache for url', url.href);
  }
  callback(result);
}

_findOnError(url, callback, event) {
  this.log.error(url.href, event.target.error);
  callback();
}

add(conn, pageURL, iconURL) {
  const entry = {};
  entry.pageURLString = this.normalizeURL(pageURL).href;
  entry.iconURLString = iconURL.href;
  entry.dateUpdated = new Date();
  this.log.debug('Adding favicon entry', entry);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
}

remove(conn, pageURL) {
  this.log.debug('Removing favicon entry with page url', pageURL.href);
  const pageURLString = this.normalizeURL(pageURL).href;
  this.log.debug('Removing if exists', pageURLString);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(pageURLString);
}

openCursor(conn, onSuccess, onError) {
  this.log.debug('Opening cursor over all favicon entries');
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = onSuccess;
  request.onerror = onError;
  return tx;
}

normalizeURL(url) {
  const clone = this.cloneURL(url);
  clone.hash = '';
  return clone;
}

cloneURL(url) {
  return new URL(url.href);
}

}
