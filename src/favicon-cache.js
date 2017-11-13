
import {assert} from "/src/assert.js";
import {closeDB, isOpenDB, openDB} from "/src/rbl.js";


export class FaviconCache {
  constructor() {
    this.conn = undefined;
    this.name = 'favicon-cache';
    this.version = 3;
    this.openTimeoutMs = 500;
  }
}

// This is a 'static' property, not instance property, so that it can be accessed without the need
// to create an instance. static in the java sense, not c.
// 30 days in ms, used by both lookup and compact to determine whether a cache entry expired
FaviconCache.MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

// Opens the cache
FaviconCache.prototype.open = async function() {
  this.conn = await openDB(this.name, this.version, this.onUpgradeNeeded, this.openTimeoutMs);

  // TODO: I would prefer this would be void, first need to ensure callers do not expect return
  // value
  return this;
};

FaviconCache.prototype.close = function() {
  closeDB(this.conn);
};

FaviconCache.prototype.setup = async function() {
  console.log('setting up favicon database', this.name, this.version);
  try {
    await this.open();
  } finally {
    this.close();
  }
};

FaviconCache.prototype.onUpgradeNeeded = function(event) {
  const conn = event.target.result;
  console.log('creating or upgrading database', conn.name);

  let store;
  if(!event.oldVersion || event.oldVersion < 1) {
    console.log('onUpgradeNeeded creating favicon-cache');

    store = conn.createObjectStore('favicon-cache', {keyPath: 'pageURLString'});
  } else {
    const tx = event.target.transaction;
    store = tx.objectStore('favicon-cache');
  }

  if(event.oldVersion < 2) {
    console.debug('onUpgradeNeeded creating dateUpdated index');
    store.createIndex('dateUpdated', 'dateUpdated');
  }

  if(event.oldVersion < 3) {
    console.debug('oldVersion < 3');
    // In the transition from 2 to 3, there are no changes. I am adding a non-indexed property.
  }
};

FaviconCache.prototype.clear = function() {
  assert(isOpenDB(this.conn));
  return new Promise((resolve, reject) => {
    console.debug('clearing favicon cache');
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

FaviconCache.prototype.findEntry = function(urlObject) {
  assert(isOpenDB(this.conn));
  return new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlObject.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

FaviconCache.prototype.findExpired = function(maxAgeMs) {
  assert(isOpenDB(this.conn));

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = FaviconCache.MAX_AGE_MS;
  }

  // TODO: assert maxAgeMs isPosInt

  return new Promise((resolve, reject) => {
    let cutoffTimeMs = Date.now() - maxAgeMs;
    cutoffTimeMs = cutoffTimeMs < 0 ? 0 : cutoffTimeMs;
    const tx = this.conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const cutoffDate = new Date(cutoffTimeMs);
    const range = IDBKeyRange.upperBound(cutoffDate);
    const request = index.getAll(range);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });
};

FaviconCache.prototype.removeByURL = function(pageURLs) {
  assert(isOpenDB(this.conn));
  return new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of pageURLs) {
      store.delete(url);
    }
  });
};

FaviconCache.prototype.put = function(entry) {
  assert(isOpenDB(this.conn));

  return new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');

    console.debug('FaviconCache.prototype.put', entry);

    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// @param pageURLs {Iterable<String>}
// @param iconURL {String}
FaviconCache.prototype.putAll = function(pageURLs, iconURL) {
  assert(isOpenDB(this.conn));

  return new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    const currentDate = new Date();
    for(const url of pageURLs) {
      const entry = {};
      entry.pageURLString = url;
      entry.iconURLString = iconURL;
      entry.dateUpdated = currentDate;

      // TEMP: ISSUE #453
      // This is called at least in the case of storing a succesful origin lookup.
      // For every fetch success, reset the failure counter to 0.
      // When creating a new entry, initialize the failure counter to 0.
      entry.failureCount = 0;

      store.put(entry);
    }
  });
};

// Finds expired entries in the database and removes them
// @throws {AssertionError}
// @throws {Error} database related
FaviconCache.prototype.compact = async function(maxAgeMs) {
  assert(isOpenDB(this.conn));
  const entries = await this.findExpired(maxAgeMs);
  const urls = [];
  for(const entry of entries) {
    urls.push(entry.pageURLString);
  }
  await this.removeByURL(urls);
};
