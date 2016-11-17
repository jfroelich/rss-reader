// See license.md

'use strict';

// A data access layer object for feed objects

class FeedStore {

  constructor(conn) {
    this.conn = conn;
  }

  // TODO: tx can't be exposed, leaky transaction?
  remove(tx, id) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('feed');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Load an array of all feed ids
  getIds() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.getAllKeys();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getAll() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // TODO: this should not be doing anything other than adding the object it
  // was given
  // TODO: deprecate, require caller to use put everywhere
  // TODO: move obj prep to caller, use put logic, rename to putFeed
  add(feed) {
    return new Promise((resolve, reject) => {
      if('id' in feed)
        return reject(new TypeError());
      let storable = Feed.sanitize(feed);
      storable = filter_empty_props(storable);
      storable.dateCreated = new Date();
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.add(storable);
      request.onsuccess = () => {
        storable.id = request.result;
        resolve(storable);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // TODO: this should do absolutely nothing to to the object it is given, the
  // caller is responsible
  // TODO: probably resolving with just new id is sufficient here now that this
  // no longer is responsible for sanitization, because it means the caller has
  // the sanitized values already
  // Adds or overwrites a feed in storage. Resolves with the stored feed. If
  // adding then the generated id is set on the input feed object.
  // @param feed {Object}
  put(feed) {
    return new Promise((resolve, reject) => {
      feed.dateUpdated = new Date();
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);
      request.onsuccess = () => {
        feed.id = feed.id || request.result;
        resolve(feed);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Returns true if a feed exists in the database with the given url
  // @param url {String}
  containsURL(url) {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const index = store.index('urls');
      const request = index.getKey(url);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // @param id {Number} feed id, positive integer
  findById(id) {
    return new Promise((resolve, reject) => {
      if(!Number.isInteger(id) || id < 1)
        return reject(new TypeError('Invalid feed id ' + id));
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
