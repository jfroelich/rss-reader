// See license.md
'use strict';

{ // Begin file block scope

async function reader_open_db(name, version, timeout_ms, verbose) {
  if(typeof name === 'undefined')
    name = 'reader';
  if(typeof version === 'undefined')
    version = 20;
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 500;
  if(verbose)
    console.debug('Connecting to indexedDB', name, version);

  const shared_state = {};
  shared_state.is_timed_out = false;

  // Race timeout against connect to avoid hanging indefinitely
  const conn_promise = connect_internal(name, version, shared_state, verbose);
  const error_msg = 'Connecting to indexedDB database ' + name + ' timed out.';
  const timeout_promise = reject_after_timeout(timeout_ms, error_msg,
    shared_state);
  const promises = [conn_promise, timeout_promise];
  return await Promise.race(promises);
}

function connect_internal(name, version, shared_state, verbose) {
  function resolver(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = on_upgrade_needed;
    request.onsuccess = function() {
      const conn = request.result;
      if(shared_state.is_timed_out) {
        if(verbose)
          console.log('connect_internal eventually finished but after timeout');
        conn.close();
      } else if(verbose)
          console.log('Connected to indexedDB', name, version);

      resolve(conn);
    }
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  }
  return new Promise(resolver);
}

function reject_after_timeout(timeout_ms, error_msg, shared_state) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 4;

  if(timeout_ms < 4) {
    shared_state.is_timed_out = true;
    const msg = 'timeout_ms must be greater than 4: ' + timeout_ms;
    throw new TypeError(msg);
  }

  function resolver(resolve, reject) {
    setTimeout(function on_timeout() {
      shared_state.is_timed_out = true;
      const error = new Error(error_msg);
      reject(error);
    }, timeout_ms);
  }

  return new Promise(resolver);
}

function on_upgrade_needed(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  console.log('Upgrading database %s to version %s from version', conn.name,
    conn.version, event.oldVersion);

  if(event.oldVersion < 20) {
    feed_store = conn.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
    entry_store = conn.createObjectStore('entry', {
      'keyPath': 'id',
      'autoIncrement': true
    });
    feed_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
    feed_store.createIndex('title', 'title');
    entry_store.createIndex('readState', 'readState');
    entry_store.createIndex('feed', 'feed');
    entry_store.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
    entry_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  } else {
    feed_store = tx.objectStore('feed');
    entry_store = tx.objectStore('entry');
  }
}

// Exports
this.reader_open_db = reader_open_db;

} // End file block scope
