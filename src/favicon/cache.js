import assert from "/src/utils/assert.js";
import * as IndexedDbUtils from "/src/utils/indexeddb-utils.js";
import isPosInt from "/src/utils/is-pos-int.js";

export default class FaviconCache {
  constructor() {
    this.conn = undefined;
    this.name = 'favicon-cache';
    this.version = 3;
    this.openTimeoutMs = 500;
  }
}

// TODO: this should be defined on prototype?
// 30 days in ms, used by both lookup and compact to determine whether a cache entry expired
FaviconCache.MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

FaviconCache.prototype.open = async function() {
  this.conn = await IndexedDbUtils.open(this.name, this.version, this.onUpgradeNeeded,
    this.openTimeoutMs);

  // TODO: I would prefer this would be void, first need to ensure callers do not expect return
  // value. Note I believe this is now the case, but I have not reviewed since.
  return this;
};

FaviconCache.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FaviconCache.prototype.close = function() {
  IndexedDbUtils.close(this.conn);
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
  return new Promise((resolve, reject) => {
    assert(IndexedDbUtils.isOpen(this.conn));
    console.debug('Clearing favicon cache');
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

FaviconCache.prototype.findEntry = function(urlObject) {

  return new Promise((resolve, reject) => {
    assert(IndexedDbUtils.isOpen(this.conn));
    const tx = this.conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(urlObject.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// TODO: if I only need entry ids in calling contexts, which currently I think is only compact,
// then this should be using getAllKeys instead of getAll?
// Returns a promise that resolves to an array of expired entries
FaviconCache.prototype.findExpired = function(maxAgeMs, limit) {

  // NOTE: using the fat arrow function here is not just use of a more succinct syntax. The promise
  // executor function here relies on the fact that 'this' is implicitly bound.

  return new Promise((resolve, reject) => {
    assert(IndexedDbUtils.isOpen(this.conn));

    if(typeof maxAgeMs === 'undefined') {
      maxAgeMs = FaviconCache.MAX_AGE_MS;
    }

    assert(isPosInt(maxAgeMs));
    assert(typeof limit === 'undefined' || isPosInt(limit));

    let cutoffTimeMs = Date.now() - maxAgeMs;
    cutoffTimeMs = cutoffTimeMs < 0 ? 0 : cutoffTimeMs;
    const tx = this.conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const cutoffDate = new Date(cutoffTimeMs);
    const range = IDBKeyRange.upperBound(cutoffDate);

    // Limit the number of items loaded into memory from the database by specifying the count
    // parameter to getAll.
    // https://w3c.github.io/IndexedDB/#dom-idbindex-getall
    // If count is specified and there are more than count records in range, only the first count
    // will be retrieved.
    // getAll is supported in Chrome 48, Firefox 44, and Safari 10.1.
    // In the section on retrieving multiple values: if count is not given or is 0, count is treated
    // as Infinity.
    // I assume that if limit is undefined this is the equivalent of "not given".
    const request = index.getAll(range, limit);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });
};

// Removes entries corresponding to the given page urls
// @param pageURLs {Array} an array of url strings
// @return {Promise}
FaviconCache.prototype.removeByURL = function(pageURLs) {

  // NOTE: uses fat arrow syntax to enable 'this' binding implicitly

  return new Promise((resolve, reject) => {
    assert(IndexedDbUtils.isOpen(this.conn));
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
  return new Promise((resolve, reject) => {
    assert(IndexedDbUtils.isOpen(this.conn));
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// @param pageURLs {Iterable<String>}
// @param iconURL {String}
FaviconCache.prototype.putAll = function(pageURLs, iconURL) {
  return new Promise((resolve, reject) => {
    assert(IndexedDbUtils.isOpen(this.conn));
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
      entry.failureCount = 0;
      store.put(entry);
    }
  });
};

// Finds expired entries in the database and removes them
// @param limit {Number} optional, the maximum number of records that may be compacted. Specifying
// a limit is helpful when there may be a large number of records, where there are so many that
// there is a risk of memory or performance issues. If not specified then all possible compactable
// records will be compacted. Specifying a limit of 0 is equivalent to specifying undefined.
FaviconCache.prototype.compact = async function(maxAgeMs, limit) {
  console.debug('Compacting favicon entries using maxAgeMs %d and limit', maxAgeMs, limit);

  assert(IndexedDbUtils.isOpen(this.conn));
  const entries = await this.findExpired(maxAgeMs, limit);
  console.debug('Found %d expired entries suitable for compaction', entries.length);
  const urls = [];
  for(const entry of entries) {
    urls.push(entry.pageURLString);
  }
  await this.removeByURL(urls);
};
