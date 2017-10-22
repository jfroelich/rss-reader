'use strict';


// import base/debug.js
// import base/indexeddb.js
// import base/number.js
// import http/url.js
// import rss/feed.js
// import rss/entry.js


const READER_DB_DEBUG = false;

// Opens a connection to the reader-db database
// @return {Promise} a promise that resolves to an open database connection
function reader_db_open() {
  const name = 'reader', version = 20, timeout_ms = 500;
  return indexeddb_open(name, version, reader_db_onupgradeneeded, timeout_ms);
}

// Helper for reader_db_open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
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
// @param conn {IDBDatabase}
// @param url {String}
function reader_db_find_feed_id_by_url(conn, url) {
  console.assert(indexeddb_is_open(conn));
  console.assert(url_is_valid(url));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// @param conn {IDBDatabase}
function reader_db_count_unread_entries(conn) {
  console.assert(indexeddb_is_open(conn));

  return new Promise(function executor(resolve, reject) {
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
// @returns {Promise} a promise that resolves to an entry object, or undefined
// if no matching entry was found
function reader_db_find_entry_by_id(conn, id) {
  console.assert(indexeddb_is_open(conn));
  console.assert(entry_is_valid_id(id));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Returns an entry ID, not an entry, matching url
// @param conn {IDBDatabase}
// @param url {String}
function reader_db_find_entry_by_url(conn, url) {
  console.assert(indexeddb_is_open(conn));
  console.assert(url_is_valid(url));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_find_entry_ids_by_feed(conn, feed_id) {
  console.assert(indexeddb_is_open(conn));
  console.assert(feed_is_valid_feed_id(feed_id));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feed_id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function reader_db_find_entries_missing_urls(conn) {
  const entries = await reader_db_get_entries(conn);
  const invalid_entries = [];
  for(const entry of entries) {
    if(!entry_has_url(entry)) {
      invalid_entries.push(entry);
    }
  }
  return invalid_entries;
}

function reader_db_find_feed_by_id(conn, feed_id) {
  console.assert(indexeddb_is_open(conn));
  console.assert(feed_is_valid_feed_id(feed_id));

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
async function reader_db_find_orphaned_entries(conn) {
  const feed_ids = await reader_db_get_feed_ids(conn);
  const entries = await reader_db_get_entries(conn);
  const orphans = [];
  for(const entry of entries) {
    if(!entry.feed || !feed_ids.includes(entry.feed)) {
      orphans.push(entry);
    }
  }
  return orphans;
}

async function reader_db_find_archivable_entries(conn, max_age_ms) {
  console.assert(indexeddb_is_open(conn));
  console.assert(number_is_positive_integer(max_age_ms));

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
  console.assert(indexeddb_is_open(conn));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_get_feeds(conn) {
  console.assert(indexeddb_is_open(conn));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_get_feed_ids(conn) {
  console.assert(indexeddb_is_open(conn));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


function reader_db_get_unarchived_unread_entries(conn, offset, limit) {
  console.assert(indexeddb_is_open(conn));

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

function reader_db_get_unarchived_unread_entries2(conn) {
  console.assert(indexeddb_is_open(conn));

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
  console.assert(indexeddb_is_open(conn));
  console.assert(feed_is_valid_feed_id(feed_id));
  console.assert(Array.isArray(entry_ids));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const feed_store = tx.objectStore('feed');
    feed_store.delete(feed_id);

    const entry_store = tx.objectStore('entry');
    for(const entry_id of entry_ids) {
      entry_store.delete(entry_id);
    }
  });
}

function reader_db_put_entry(conn, entry) {
  console.assert(indexeddb_is_open(conn));
  console.assert(entry_is_entry(entry));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function reader_db_put_entries(conn, entries) {
  console.assert(indexeddb_is_open(conn));
  console.assert(Array.isArray(entries));

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
  console.assert(indexeddb_is_open(conn));
  console.assert(feed_is_feed(feed));

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

// @param conn {IDBDatabase}
// @param ids {Array}
// @param channel {BroadcastChannel}
function reader_db_remove_entries(conn, ids, channel) {
  console.assert(indexeddb_is_open(conn));
  console.assert(Array.isArray(ids));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = function(event) {

      // Now that the transaction has completed, dispatch messages
      if(channel) {
        for(const id of ids) {
          channel.postMessage({'type': 'entryDeleted', 'id': id});
        }
      }

      resolve();
    };
    tx.onerror = () => reject(tx.error);

    const store = tx.objectStore('entry');
    for(const id of ids) {
      store.delete(id);
    }
  });
}
