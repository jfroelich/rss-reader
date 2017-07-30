// See license.md
'use strict';

{ // Begin file block scope

async function openReaderDb(name, version, timeoutMillis, verbose) {
  if(typeof name === 'undefined') {
    name = 'reader';
  }
  if(typeof version === 'undefined') {
    version = 20;
  }

  // For app purposes use a custom default timeout over the generic timeout
  // policy in rejectAfterTimeout
  // I've lengthened it from 20 to 50 to 500. I've noticed it occassionally
  // hangs, no clue.
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 500;
  }

  if(verbose) {
    console.debug('Connecting to indexedDB', name, version);
  }

  const sharedState = {};
  sharedState.didTimeout = false;

  // Race timeout against connect to avoid hanging indefinitely
  const connectPromise = connectInternal(name, version, sharedState, verbose);
  const errorMessage = 'Connecting to indexedDB database ' + name +
    ' timed out.';
  const timeoutPromise = rejectAfterTimeout(timeoutMillis, errorMessage,
    sharedState);
  const promises = [connectPromise, timeoutPromise];
  return await Promise.race(promises);
}

function connectInternal(name, version, sharedState, verbose) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = onUpgradeNeeded;
    request.onsuccess = function() {
      const conn = request.result;
      if(sharedState.didTimeout) {
        if(verbose) {
          console.log('connectInternal eventually finished but after timeout');
        }
        // Close the connection as it will be ignored
        conn.close();
      } else {
        if(verbose) {
          console.log('Connected to indexedDB', name, version);
        }
      }

      resolve(conn);
    }
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
}

function rejectAfterTimeout(timeoutMillis, errorMessage, sharedState) {
  if(typeof timeoutMillis === 'undefined') {
    timeoutMillis = 4;
  }

  // Throw immediately, this is more like a syntax error
  if(timeoutMillis < 4) {
    sharedState.didTimeout = true;
    throw new TypeError('timeoutMillis must be greater than 4: ' +
      timeoutMillis);
  }

  return new Promise((resolve, reject) => {
    setTimeout(function() {
      sharedState.didTimeout = true;
      const error = new Error(errorMessage);
      reject(error);
    }, timeoutMillis);
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
