(function(exports) {
'use strict';

// TODO: cancel/close the conn if timeout occurred
// TODO: cancel the timeout if connected
async function open(name, version, timeout_ms, verbose) {
  if(typeof name === 'undefined')
    name = 'reader';
  if(typeof version === 'undefined')
    version = 20;
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 500;
  if(verbose)
    console.log('Connecting to indexedDB', name, version);

  const shared_state = {};
  shared_state.is_timed_out = false;

  // Race timeout against connect to avoid hanging indefinitely on block and
  // to set an upper bound
  const conn_promise = open_internal(name, version, shared_state, verbose);
  const error_msg = 'Connecting to indexedDB database ' + name + ' timed out.';
  const timeout_promise = reject_after_timeout(timeout_ms, error_msg,
    shared_state);
  const promises = [conn_promise, timeout_promise];
  return await Promise.race(promises);
}

function open_internal(name, version, shared_state, verbose) {
  return new Promise(function(resolve, reject) {
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = on_upgrade_needed;
    request.onsuccess = function() {
      const conn = request.result;
      if(shared_state.is_timed_out) {
        if(verbose)
          console.log('open_internal eventually finished but after timeout');
        conn.close();
        // TODO: reject and exit here?
      } else if(verbose)
          console.log('Connected to indexedDB', name, version);

      resolve(conn);
    }
    request.onerror = () => reject(request.error);
    request.onblocked = console.warn;
  });
}

function reject_after_timeout(timeout_ms, error_msg, shared_state) {
  if(typeof timeout_ms === 'undefined')
    timeout_ms = 4;

  if(timeout_ms < 4) {
    shared_state.is_timed_out = true;
    const msg = 'timeout_ms must be greater than 4: ' + timeout_ms;
    throw new TypeError(msg);
  }

  return new Promise(function(resolve, reject) {
    setTimeout(function() {
      shared_state.is_timed_out = true;
      const error = new Error(error_msg);
      reject(error);
    }, timeout_ms);
  });
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

// TODO: rename to find_feed_id_by_url
// Returns truthy if a feed exists in the database with the given url
function contains_feed_url(conn, url_string) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url_string);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function count_unread_entries(conn) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function find_entry_by_id(conn, id) {
  // It is important to explicitily guard against the use of an invalid id
  // as otherwise it ambiguous whether a failure is because an entry does not
  // exist or because the id was incorrect
  // This is done outside of the promise because this is static
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

function find_entry_by_url(conn, url_string) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url_string);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: rename to find_entry_ids_by_feed
function find_entry_ids_for_feed(conn, feed_id) {
  return new Promise(function(resolve, reject) {
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
async function find_entries_missing_urls(conn) {
  const entries = await reader_db.get_entries(conn);
  const invalid_entries = [];
  for(const entry of entries)
    if(!entry.urls || !entry.urls.length)
      invalid_entries.push(entry);
  return invalid_entries;
}

function find_feed_by_id(conn, feed_id) {
  return new Promise(function(resolve, reject) {
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
async function find_orphaned_entries(conn) {
  const feed_ids = await get_feed_ids(conn);
  const entries = await get_entries(conn);
  const orphans = [];
  for(const entry of entries)
    if(!entry.feed || !feed_ids.includes(entry.feed))
      orphans.push(entry);
  return orphans;
}

function get_entries(conn) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function get_feeds(conn) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function get_feed_ids(conn) {
  return new Promise(function(resolve, reject) {
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
function load_unarchived_unread_entries(conn, offset, limit) {
  return new Promise(function(resolve, reject) {
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
function load_unarchived_unread_entries2(conn) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.getAll(key_path);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function remove_feed_and_entries(conn, feed_id, entry_ids) {
  return new Promise(function(resolve, reject) {
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

function put_entry(conn, entry) {
  return new Promise(function(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function put_entries(conn, entries) {
  return new Promise(function(resolve, reject) {
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
function put_feed(conn, feed) {
  return new Promise(function(resolve, reject) {
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

function remove_entry(tx, id, channel) {
  return new Promise(function(resolve, reject) {
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

function remove_entries(conn, ids, channel) {
  const tx = conn.transaction('entry', 'readwrite');
  const promises = [];
  for(const id of ids) {
    const promise = remove_entry(tx, id, channel);
    promises.push(promise);
  }
  return Promise.all(promises);
}

exports.reader_db = {
  'contains_feed_url': contains_feed_url,
  'count_unread_entries': count_unread_entries,
  'find_entry_by_id': find_entry_by_id,
  'find_entry_by_url': find_entry_by_url,
  'find_entry_ids_for_feed': find_entry_ids_for_feed,
  'find_entries_missing_urls': find_entries_missing_urls,
  'find_feed_by_id': find_feed_by_id,
  'find_orphaned_entries': find_orphaned_entries,
  'get_entries': get_entries,
  'get_feed_ids': get_feed_ids,
  'get_feeds': get_feeds,
  'load_unarchived_unread_entries': load_unarchived_unread_entries,
  'load_unarchived_unread_entries2': load_unarchived_unread_entries2,
  'remove_feed_and_entries': remove_feed_and_entries,
  'open': open,
  'put_entry': put_entry,
  'put_entries': put_entries,
  'put_feed': put_feed,
  'remove_entry': remove_entry,
  'remove_entries': remove_entries
};

}(this));
