// See license.md

'use strict';

// Provides storage for memoizing favicon lookups
class FaviconCache {

constructor(log) {
  this.name = 'favicon-cache';
  this.version = 1;
  this.max_age = 1000 * 60 * 60 * 24 * 30;
  this.log = log || SilentConsole;
}

// TODO: need to properly react to blocked event similar to FeedDb

connect(on_success, on_error) {
  this.log.log('Connecting to database', this.name, 'version', this.version);
  const request = indexedDB.open(this.name, this.version);
  request.onupgradeneeded = this._upgrade.bind(this);
  request.onsuccess = on_success;
  request.onerror = on_error;
  request.onblocked = on_error;
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

is_expired(entry, max_age) {
  const entryAge = new Date() - entry.dateUpdated;
  return entryAge >= max_age;
}

find(conn, url, callback) {
  this.log.log('Checking favicon cache for page url', url.href);
  const page_url = this.normalize_url(url).href;
  const tx = conn.transaction('favicon-cache');
  const store = tx.objectStore('favicon-cache');
  const request = store.get(page_url);
  request.onsuccess = this._find_on_success.bind(this, url, callback);
  request.onerror = this._find_on_error.bind(this, url, callback);
}

_find_on_success(url, callback, event) {
  const result = event.target.result;
  if(result) {
    this.log.log('Found icon url %s in cache for url %s', result.iconURLString,
      url.href);
  } else {
    this.log.log('Did not find icon in cache for url', url.href);
  }
  callback(result);
}

_find_on_error(url, callback, event) {
  this.log.error(url.href, event.target.error);
  callback();
}

add(conn, pageURL, iconURL) {
  const entry = {};
  entry.pageURLString = this.normalize_url(pageURL).href;
  entry.iconURLString = iconURL.href;
  entry.dateUpdated = new Date();
  this.log.debug('Adding favicon entry', entry);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.put(entry);
}

remove(conn, pageURL) {
  this.log.debug('Removing favicon entry with page url', pageURL.href);
  const page_url = this.normalize_url(pageURL).href;
  this.log.debug('Removing if exists', page_url);
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  store.delete(page_url);
}

open_cursor(conn, on_success, on_error) {
  this.log.debug('Opening cursor over all favicon entries');
  const tx = conn.transaction('favicon-cache', 'readwrite');
  const store = tx.objectStore('favicon-cache');
  const request = store.openCursor();
  request.onsuccess = on_success;
  request.onerror = on_error;
  return tx;
}

normalize_url(url) {
  const clone = this.clone_url(url);
  clone.hash = '';
  return clone;
}

clone_url(url) {
  return new URL(url.href);
}

}
