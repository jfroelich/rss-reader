// See license.md

'use strict';

// TODO: create github issues for these todos
// TODO: add/update feed should delegate to put feed
// TODO: maybe merge add/put entry into one function

// TODO: remove the defined feed title requirement, have options manually sort
// feeds instead of using the title index, deprecate the title index, stop
// ensuring title is an empty string. note: i partly did some of this

// Wraps an opened IDBDatabase instance to provide storage related functions
class FeedDb {

  constructor() {

    this.conn = null;
    this.name = 'reader';
    this.version = 20;
  }

  close() {
    if(this.conn) {
      this.conn.close();
    }
  }

  connect() {
    return new Promise((resolve, reject) => {
      if(!this.name)
        throw new TypeError('Databases must be named');
      if(!Number.isInteger(this.version) < this.version < 1)
        throw new TypeError('Invalid database version ' + this.version)
      const request = indexedDB.open(this.name, this.version);
      request.onupgradeneeded = this.upgrade.bind(this);
      request.onsuccess = () => {
        this.conn = request.result;
        resolve(this.conn);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        console.warn('Waiting on blocked connection...');
    });
  }

  // TODO: revert upgrade to using a version migration approach
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

  static removeDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}
