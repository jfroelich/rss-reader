// See license.md
'use strict';

{ // Begin file block scope

async function openReaderDb(name, version, timeoutMillis) {
  if(typeof name === 'undefined') {
    name = 'reader';
  }
  if(typeof version === 'undefined') {
    version = 20;
  }

  // For app purposes use a custom default timeout over the generic timeout
  // policy in rejectAfterTimeout
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 10;
  }

  // Race timeout against connect to avoid hanging indefinitely
  const connectPromise = connectInternal(name, version);
  const errorMessage = 'Connecting to indexedDB database ' + name +
    ' timed out.';
  const timeoutPromise = rejectAfterTimeout(timeoutMillis, errorMessage);
  const promises = [connectPromise, timeoutPromise];
  return await Promise.race(promises);
}

function connectInternal(name, version) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = onUpgradeNeeded;
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
}

function rejectAfterTimeout(timeoutMillis, errorMessage) {
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 4;
  }

  if(timeoutMillis < 4) {
    throw new TypeError('timeoutMillis must be greater than 4: ' +
      timeoutMillis);
  }

  return new Promise((resolve, reject) => {
    const error = new Error(errorMessage);
    setTimeout(reject, timeoutMillis, error);
  });
}

function onUpgradeNeeded(event) {
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

// Exports
this.openReaderDb = openReaderDb;

} // End file block scope
