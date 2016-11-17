// See license.md

'use strict';

class EntryStore {

  constructor() {

  }

  // TODO: tx can't be exposed, this is a leaky abstraction?
  getIds(tx, feedId) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('entry');
      const index = store.index('feed');
      const request = index.getAllKeys(feedId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getAll() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  getUnarchivedRead() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('archiveState-readState');
      const key_path = [Entry.UNARCHIVED, Entry.READ];
      const request = index.getAll(key_path);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }


  // TODO: use getAll, passing in a count parameter as an upper limit, and
  // then using slice or unshift or something to advance.
  // TODO: internally the parameter to getAll might be (offset+limit)
  getUnarchivedUnread(offset, limit) {
    return new Promise((resolve, reject) => {
      const entries = [];
      let counter = 0;
      let advanced = false;
      const tx = this.conn.transaction('entry');
      tx.oncomplete = (event) => resolve(entries);
      const store = tx.objectStore('entry');
      const index = store.index('archiveState-readState');
      const keyPath = [Entry.UNARCHIVED, Entry.UNREAD];
      const request = index.openCursor(keyPath);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if(!cursor)
          return;
        if(offset && !advanced) {
          advanced = true;
          this.log.debug('Advancing cursor by', offset);
          cursor.advance(offset);
          return;
        }
        entries.push(cursor.value);
        if(limit > 0 && ++counter < limit)
          cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
  }

  // Resolves with an entry object, or undefined if no entry was found.
  // Rejects when an error occurred.
  findById(tx, id) {
    return new Promise((resolve, reject) => {
      const request = tx.objectStore('entry').get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  countUnread() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('readState');
      const request = index.count(Entry.UNREAD);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // TODO: tx can't be exposed as it is leaky abstraction?
  // @param tx {IDBTransaction}
  // @param id {int}
  // @param chan {BroadcastChannel}
  remove(tx, id, chan) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('entry');
      const request = store.delete(id);
      request.onsuccess = () => {
        resolve();
        chan.postMessage({'type': 'entryDeleted', 'id': id});
      };
      request.onerror = () => reject(request.error);
    });
  }


  // TODO: deprecate in favor of put, and after moving sanitization and
  // default props out, maybe make a helper function in pollfeeds that does this
  // TODO: ensure entries added by put, if not have id, have unread flag
  // and date created
  // TODO: this should be nothing other than putting. Caller is responsible
  // for sanitizing and setting defaults.
  add(entry) {
    return new Promise((resolve, reject) => {
      if('id' in entry)
        return reject(new TypeError());
      const sanitized = Entry.sanitize(entry);
      const storable = filter_empty_props(sanitized);
      storable.readState = Entry.UNREAD;
      storable.archiveState = Entry.UNARCHIVED;
      storable.dateCreated = new Date();
      const tx = this.conn.transaction('entry', 'readwrite');
      const store = tx.objectStore('entry');
      const request = store.add(storable);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }


  // Resolves when the entry has been stored to the result of the request
  // If entry.id is not set this will result in adding
  // Sets dateUpdated before put. Impure.
  // @param tx {IDBTransaction} the tx should include entry store and be rw
  put(tx, entry) {
    return new Promise((resolve, reject) => {
      entry.dateUpdated = new Date();
      const request = tx.objectStore('entry').put(entry);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Promise.all is failfast so this aborts if any one entry fails
  async putAll(entries) {
    const tx = this.conn.transaction('entry', 'readwrite');
    const proms = entries.map((entry) => this.put(tx, entry));
    return await Promise.all(proms);
  }

  // Resolves with a boolean indicating whether an entry with the given url
  // was found in storage
  // @param url {String}
  containsURL(url) {
    return new Promise((resolve, reject) => {
      if(typeof url !== 'string')
        return reject(new TypeError('Invalid url argument'));
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('urls');
      const request = index.getKey(url);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }
}
