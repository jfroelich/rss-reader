// Library for working with the reader app's database
'use strict';

// Dependencies:
// assert.js
// debug.js

// @private
const READER_DB_DEBUG = false;

// Opens a connection to the database. If version is greater than current
// version then database upgrades. If timeout given then open fails if database
// does not open within a certain amount of time.
// @param name {String} database name
// @param version {Number} optional version number
// @param timeout_ms {Number} optional timeout in milliseconds
// @return {IDBDatabase} an open database connection handle
// TODO: cancel/close the conn if timeout occurred
// TODO: cancel the timeout if connected
// TODO: make a promise utils library that does a timed operation promise,
// then delegate the race boilerplate to that library. Look further into
// whether cancelable promises have been implemented. Or, at least create
// a generic indexedDB lib that helps with this and delegate to that?
async function reader_db_open(name, version, timeout_ms) {
  if(typeof name === 'undefined')
    name = 'reader';
  if(typeof version === 'undefined')
    version = 20;
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 500;
  if(READER_DB_DEBUG)
    DEBUG('connecting to database', name, version);

  const shared_state = {};
  shared_state.is_timed_out = false;

  // Race timeout against connect to avoid hanging indefinitely on block and
  // to set an upper bound
  const conn_promise = reader_db_open_internal(name, version, shared_state);
  const error_msg = 'connecting to indexedDB database ' + name + ' timed out.';
  const timeout_promise = reader_db_reject_after_timeout(timeout_ms, error_msg,
    shared_state);
  const promises = [conn_promise, timeout_promise];
  return await Promise.race(promises);
}

// Helper for reader_db_open. Wraps indexedDB.open in a promise.
// @private
function reader_db_open_internal(name, version, shared_state) {
  return new Promise(function executor(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = reader_db_onupgradeneeded;
    request.onsuccess = function() {
      const conn = request.result;
      if(shared_state.is_timed_out) {
        if(READER_DB_DEBUG)
          DEBUG('opened db but after timeout');
        conn.close();
        // TODO: reject and exit here?
      }

      if(READER_DB_DEBUG)
        DEBUG('connected to database %s v', name, version);
      resolve(conn);
    };
    request.onerror = () => reject(request.error);

    // When open blocks, it blocks indefinitely. Therefore the promise cannot
    // resolve. This is primarily why I've implemented a timeout scheme, to
    // avoid the indefiniteness.
    request.onblocked = console.warn;
  });
}

// Helper for reader_db_open. Return a promise that rejects after a given
// amount of time.
// @private
// @param timeout_ms {Number} timeout in milliseconds, optional
// @param error_msg {String} optional, error message
// @param shared_state {Object} helps coordinate between the two concurrent
// processes of opening the database and a timed rejection.
function reader_db_reject_after_timeout(timeout_ms, error_msg, shared_state) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 4;

  if(timeout_ms < 4) {
    // TODO: why am I doing this? I don't think this is relevant
    shared_state.is_timed_out = true;

    const msg = 'timeout_ms must be greater than 4: ' + timeout_ms;
    throw new TypeError(msg);
  }

  return new Promise(function set_timeout_executor(resolve, reject) {
    setTimeout(function set_timeout_callback() {
      shared_state.is_timed_out = true;
      reject(new Error(error_msg));
    }, timeout_ms);
  });
}

// Helper for reader_db_open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
// @private
function reader_db_onupgradeneeded(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  if(READER_DB_DEBUG) {
    DEBUG('upgrading database %s to version %s from version', conn.name,
      conn.version, event.oldVersion);
  }

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

// Returns feed id if a feed with the given url exists in the database
function reader_db_find_feed_id_by_url(conn, url_string) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url_string);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_count_unread_entries(conn) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Searches for and returns an entry object matching the id
// @param conn {IDBDatabase} an open database connection
// @param id {Number} id of entry to find
// @return {Promise} a promise that resolves to an entry object, or undefined
// if no matching entry was found
// @throws {Error} if there was a database error
function reader_db_find_entry_by_id(conn, id) {
  // It is important to explicitily guard against the use of an invalid id
  // as otherwise it ambiguous whether a failure is because an entry does not
  // exist or because the id was incorrect
  // This is done outside of the promise because this is a violation of an
  // invariant condition.
  ASSERT(entry_is_valid_id(id), 'Invalid entry id');

  return new Promise(function(resolve, reject) {
    // If conn is undefined the next line fails. In the context of a promise
    // this is a swallowed exception that is equivalent to a rejection.
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_find_entry_by_url(conn, url_string) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url_string);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_find_entry_ids_for_feed(conn, feed_id) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feed_id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: avoid loading all entries from the database. This
// involves too much processing. It probably easily triggers a violation
// message that appears in the console for taking too long.
// Maybe using a cursor walk instead of get all avoids this?
// Maybe introduce a limit on the number of entries fetched
async function reader_db_find_entries_missing_urls(conn) {
  const entries = await reader_db_get_entries(conn);
  const invalid_entries = [];
  for(const entry of entries)
    if(!entry.urls || !entry.urls.length)
      invalid_entries.push(entry);
  return invalid_entries;
}

function reader_db_find_feed_by_id(conn, feed_id) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Returns an array of all entries missing a feed id or have a feed id that
// does not exist in the set of feed ids
// TODO: think of how to optimize this function so that not all entries are
// loaded. One idea is that if I create an index on feed id I somehow can
// just load all the keys of that index. But that won't work I think, because
// missing values are not indexed ...
// TODO: think of how to make this more scalable, e.g. use a cursor over
// feeds? Maybe it doesn't matter.
async function reader_db_find_orphaned_entries(conn) {
  const feed_ids = await reader_db_get_feed_ids(conn);
  const entries = await get_entries(conn);
  const orphans = [];
  for(const entry of entries)
    if(!entry.feed || !feed_ids.includes(entry.feed))
      orphans.push(entry);
  return orphans;
}


// TODO: Optimize. So not load all entries. Once, I observed the
// following error for the call to load entries
// [Violation] 'success' handler took 164ms
async function reader_db_find_archivable_entries(conn, max_age_ms) {
  ASSERT(Number.isInteger(max_age_ms));
  ASSERT(max_age_ms >= 0);

  const entries = await reader_db_get_unarchived_unread_entries2(conn);
  const archivable_entries = [];
  const current_date = new Date();
  for(const entry of entries) {
    const entry_age_ms = current_date - entry.dateCreated;
    if(entry_age_ms > max_age_ms)
      archivable_entries.push(entry);
  }
  return archivable_entries;
}

function reader_db_get_entries(conn) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_get_feeds(conn) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_get_feed_ids(conn) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: rename to get_all or just get_ ...
// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance. The parameter to getAll
// might be (offset+limit)
function reader_db_get_unarchived_unread_entries(conn, offset, limit) {
  return new Promise(function executor(resolve, reject) {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const is_limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = function(event) {
      resolve(entries);
    };
    tx.onerror = function(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(key_path);
    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(is_limited && ++counter < limit)
            cursor.continue();
        }
      }
    };
  });
}

// Returns a Promise that resolves to an array
// TODO: think of how to merge with load_unarchived_unread_entries
function reader_db_get_unarchived_unread_entries2(conn) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.getAll(key_path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_remove_feed_and_entries(conn, feed_id, entry_ids) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    const feed_store = tx.objectStore('feed');
    feed_store.delete(feed_id);
    const entry_store = tx.objectStore('entry');
    for(const entry_id of entry_ids)
      entry_store.delete(entry_id);
  });
}

function reader_db_put_entry(conn, entry) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_put_entries(conn, entries) {
  return new Promise(function executor(resolve, reject) {
    const current_date = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = function tx_onerror(event) {
      reject(tx.error);
    };
    const entry_store = tx.objectStore('entry');
    for(const entry of entries) {
      entry.dateUpdated = current_date;
      entry_store.put(entry);
    }
  });
}

// Adds or overwrites a feed in storage. Resolves with the new feed id if add.
// There are no side effects other than the database modification.
// @param conn {IDBDatabase} an open database connection
// @param feed {Object} the feed object to add
function reader_db_put_feed(conn, feed) {
  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  });
}

// TODO: do it all here, do not delegate to reader_db_remove_entry
// TODO: wait to post messages until transaction completes, to avoid
// premature notification
function reader_db_remove_entries(conn, ids, channel) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = [];
  for(const id of ids)
    promises.push(reader_db_remove_entry(tx, id, channel));
  return Promise.all(promises);
}

function reader_db_remove_entry(tx, id, channel) {
  return new Promise(function executor(resolve, reject) {
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = () => {
      if(channel)
        channel.postMessage({'type': 'entryDeleted', 'id': id});
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
}
