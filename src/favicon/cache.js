

// TODO: cache shold be merged with lookup into service
// TODO: service should be decoupled from all common libraries and roll its own, to provide a
// more severe service boundary. So it should return its own error codes and make use of its
// own db utils library.
// TODO: it's possible that service should not be a class, but instead just a module that
// exposes a few functions.

import assert from "/src/common/assert.js";
import * as IndexedDbUtils from "/src/common/indexeddb-utils.js";
import * as Status from "/src/common/status.js";

export default class FaviconCache {
  constructor() {
    this.conn = null;
    this.name = 'favicon-cache';
    this.version = 3;
    this.timeout = 500;
  }
}

// 30 days in ms, used by both lookup and compact to determine whether a cache entry expired
FaviconCache.MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30;

FaviconCache.prototype.open = async function() {
  if(this.isOpen()) {
    return Status.EINVALIDSTATE;
  }

  const [status, conn] = await IndexedDbUtils.open(this.name, this.version, onUpgradeNeeded,
    this.timeout);
  if(status === Status.OK) {
    this.conn = conn;
  }

  return status;
};

FaviconCache.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FaviconCache.prototype.close = function() {
  if(!this.conn) {
    return Status.EINVALIDSTATE;
  }

  if(!this.isOpen()) {
    return Status.EINVALIDSTATE;
  }

  IndexedDbUtils.close(this.conn);
  this.conn = void this.conn;
  return Status.OK;
};

FaviconCache.prototype.setup = async function() {
  assert(typeof this.name === 'string' && this.name.length > 0);
  assert(typeof this.version === 'number' && this.version >= 0);
  console.log('Setting up favicon database', this.name, this.version);
  try {
    await this.open();
  } finally {
    this.close();
  }
};

function onUpgradeNeeded(event) {
  const conn = event.target.result;
  console.log('Creating or upgrading database', conn.name);

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
}

FaviconCache.prototype.clear = async function() {
  console.debug('Clearing favicon cache');

  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.clear();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  try {
    await promise;
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  return Status.OK;
};

FaviconCache.prototype.findEntry = async function(url) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!(url instanceof URL)) {
    console.error('Invalid url parameter', url);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const request = store.get(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let entry;
  try {
    entry = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entry];
};

// Returns a promise that resolves to an array of expired entries
// TODO: if I only need entry ids in calling contexts, which currently I think is only compact,
// then this should be using getAllKeys instead of getAll?
FaviconCache.prototype.findExpired = async function(maxAgeMs, limit) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(typeof maxAgeMs === 'undefined') {
    maxAgeMs = FaviconCache.MAX_AGE_MS;
  }

  if(!Number.isInteger(maxAgeMs) || maxAgeMs < 0) {
    console.error('Invalid max age argument', maxAgeMs);
    return [Status.EINVAL];
  }

  if(typeof limit !== 'undefined') {
    if(!Number.isInteger(limit) || limit < 0) {
      console.error('Invalid limit argument', limit);
      return [Status.EINVAL];
    }
  }

  const promise = new Promise((resolve, reject) => {
    let cutoffTimeMs = Date.now() - maxAgeMs;
    cutoffTimeMs = cutoffTimeMs < 0 ? 0 : cutoffTimeMs;
    const tx = this.conn.transaction('favicon-cache');
    const store = tx.objectStore('favicon-cache');
    const index = store.index('dateUpdated');
    const cutoffDate = new Date(cutoffTimeMs);
    const range = IDBKeyRange.upperBound(cutoffDate);
    const request = index.getAll(range, limit);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(request.error);
  });

  let entries;
  try {
    entries = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entries];
};

// Removes entries corresponding to the given page urls
// @param pageURLs {Array} an array of url strings
// @return {Promise}
FaviconCache.prototype.removeByURL = async function(pageURLs) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  if(!Array.isArray(pageURLs)) {
    console.error('Invalid page urls argument', pageURLs);
    return Status.EINVAL;
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('favicon-cache');
    for(const url of pageURLs) {
      store.delete(url);
    }
  });

  try {
    await promise;
  } catch(error) {
    return Status.EDB;
  }
  return Status.OK;
};

FaviconCache.prototype.put = async function(entry) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('favicon-cache', 'readwrite');
    const store = tx.objectStore('favicon-cache');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let result;
  try {
    result = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, result];
};

// @param pageURLs {Iterable<String>}
// @param iconURL {String}
FaviconCache.prototype.putAll = async function(pageURLs, iconURL) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  const promise = new Promise((resolve, reject) => {
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

  try {
    await promise;
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  return Status.OK;
};

// Finds expired entries in the database and removes them
// @param limit {Number} optional, the maximum number of records that may be compacted. Specifying
// a limit is helpful when there may be a large number of records, where there are so many that
// there is a risk of memory or performance issues. If not specified then all possible compactable
// records will be compacted. Specifying a limit of 0 is equivalent to specifying undefined.
FaviconCache.prototype.compact = async function(maxAgeMs, limit) {
  console.log('Compacting favicon entries', maxAgeMs, limit);

  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  // TODO: if I only use the url property, then I should think about how to only load urls
  // instead of full entries

  let [status, entries] = await this.findExpired(maxAgeMs, limit);
  if(status !== Status.OK) {
    console.error('Failed to find expired entries with status', status);
    return status;
  }

  console.debug('Found %d expired entries suitable for compaction', entries.length);

  const urls = entries.map(entry => entry.pageURLString);

  status = await this.removeByURL(urls);
  if(status !== Status.OK) {
    console.error('Failed to remove entry by url with status', status);
    return status;
  }

  return Status.OK;
};
