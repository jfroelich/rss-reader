// See license.md

'use strict';

// Wraps an opened IDBDatabase instance to provide storage related functions
class ReaderDb {

  constructor(name, version) {
    this.name = name || 'reader';
    this.version = version || 20;

    if(!this.name)
      throw new TypeError('Databases must be named');
    if(!Number.isInteger(this.version) < this.version < 1)
      throw new TypeError('Invalid database version ' + this.version)
  }

  connect() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = this.upgrade.bind(this);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        console.warn('Waiting on blocked connection...');
    });
  }

  upgrade(event) {
    const conn = event.target.result;
    const tx = event.target.transaction;
    let feedStore, entryStore;
    const stores = conn.objectStoreNames;

    console.dir(event);
    console.log('Upgrading database %s to version %s from version', conn.name,
      event.version, event.oldVersion);

    if(event.oldVersion < 20) {
      feedStore = conn.createObjectStore('feed', {
        'keyPath': 'id',
        'autoIncrement': true
      });
      entryStore = conn.createObjectStore('entry', {
        'keyPath': 'id',
        'autoIncrement': true
      });
      feedStore.createIndex('urls', 'urls', {
        'multiEntry': true,
        'unique': true
      });
      feedStore.createIndex('title', 'title');
      entryStore.createIndex('readState', 'readState');
      entryStore.createIndex('feed', 'feed');
      entryStore.createIndex('archiveState-readState',
        ['archiveState', 'readState']);
      entryStore.createIndex('urls', 'urls', {
        'multiEntry': true,
        'unique': true
      });
    } else {
      feedStore = tx.objectStore('feed');
      entryStore = tx.objectStore('entry');
    }
  }
}
