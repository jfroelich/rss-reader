// See license.md

'use strict';

// TODO: create github issues for these todos
// TODO: add/update feed should delegate to put feed
// TODO: maybe merge add/put entry into one function
// TODO: maybe entry states should be in a single property instead of
// two props, like UNREAD_UNARCHIVED
// TODO: remove the defined feed title requirement, have options manually sort
// feeds instead of using the title index, deprecate the title index, stop
// ensuring title is an empty string. note: i partly did some of this
// TODO: I don't think this needs logging functionality??
// TODO: I have mixed feelings about this. It isn't purpose aligned, it has poor
// coherency. I need to review SRP here. Yes, it is nice to have a single
// abstraction around the db. But not for the queries really. Even though they
// all share the conn parameter, and are db related.
// I should be designing modules around their purpose. The task is to clearly
// define what are the purposes. I don't have a clear idea.

// Wraps an opened IDBDatabase instance to provide storage related functions
class FeedDb {

  constructor() {
    this.log = {
      'log': function(){},
      'debug': function(){},
      'warn': function(){},
      'error': function(){}
    };
    this.conn = null;
    this.name = 'reader';
    this.version = 20;
  }

  close() {
    if(this.conn) {
      this.log.debug('Closing', this.conn.name);
      this.conn.close();
    } else {
      this.log.warn('Connection is undefined');
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
        this.log.debug('Connected to', this.conn.name);
        resolve(this.conn);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () =>
        this.log.warn('Waiting on blocked connection...');
    });
  }

  // TODO: revert upgrade to using a version migration approach
  upgrade(event) {
    const conn = event.target.result;
    const tx = event.target.transaction;
    let feedStore, entryStore;
    const stores = conn.objectStoreNames;

    console.dir(event);
    this.log.log('Upgrading database %s to version %s from version', conn.name,
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
