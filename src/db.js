// See license.md

'use strict';

function dbConnect(inputName, inputVersion) {

  const onUpgradeNeeded = function(event) {
    const conn = event.target.result;
    const tx = event.target.transaction;
    let feedStore, entryStore;
    const stores = conn.objectStoreNames;

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

  const onBlocked = function() {
    console.warn('Waiting on blocked connection...');
  };


  const name = inputName || 'reader';
  const version = inputVersion || 20;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = onUpgradeNeeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = onBlocked;
  });
}
