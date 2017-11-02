'use strict';

// import base/indexeddb.js
// import base/number.js
// import net/url-utils.js
// import feed.js
// import entry.js

// Opens a connection to the reader-db database
// @return {Promise} a promise that resolves to an open database connection
function readerDbOpen() {
  const name = 'reader', version = 20, timeoutMs = 500;
  return indexedDBOpen(name, version, readerDbOnUpgradeNeeded, timeoutMs);
}

// Helper for readerDbOpen. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
function readerDbOnUpgradeNeeded(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feedStore, entryStore;
  const stores = conn.objectStoreNames;

  console.log('upgrading database %s to version %s from version', conn.name,
    conn.version, event.oldVersion);

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

// Returns feed id if a feed with the given url exists in the database
// @param conn {IDBDatabase}
// @param url {String}
function readerDbFindFeedIdByURL(conn, url) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(URLUtils.isValid(url));

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
function readerDbCountUnreadEntries(conn) {
  console.assert(indexedDBIsOpen(conn));

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
function readerDbFindEntryById(conn, id) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(entryIsValidId(id));

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
function readerDbFindEntryByURL(conn, url) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(URLUtils.isValid(url));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readerDbFindEntryIdsByFeedId(conn, feedId) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(feedIsValidId(feedId));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readerDbFindFeedById(conn, feedId) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(feedIsValidId(feedId));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: is this in use? deprecate if not. I don't think it is
function readerDbGetEntries(conn) {
  console.assert(indexedDBIsOpen(conn));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readerDbGetFeeds(conn) {
  console.assert(indexedDBIsOpen(conn));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readerDbGetFeedIds(conn) {
  console.assert(indexedDBIsOpen(conn));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Limit applies to the return array size, not num scanned
// Limit should be > 0 (only weakly asserted).
function readerDbFindEntries(conn, predicate, limit) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(typeof predicate === 'function');
  console.assert(numberIsPositiveInteger(limit));
  console.assert(limit > 0);

  return new Promise(function executor(resolve, reject) {
    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = function(event) {
      reject(tx.error);
    };

    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const request = store.openCursor();

    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
      if(!cursor) {
        // Either no entries, or iterated all. Do not advance. Allow the
        // transaction to settle which allows the promise to settle.
        return;
      }

      const entry = cursor.value;

      if(predicate(entry)) {
        console.debug('readerDbFindEntries predicate true', entry.id);
        entries.push(entry);

        if(entries.length === limit) {
          console.debug('readerDbFindEntries reached limit ');
          // Do not advance. Allow the transaction to settle which allows
          // the promise to settle.
          return;
        }
      }

      cursor.continue();
    };
  });
}

function readerDbFindArchivableEntries(conn, predicate, limit) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(typeof predicate === 'function');

  // Only using weak asserts. Caller should use a correct limit. Right now
  // an incorrect limit causes undefined behavior.
  console.assert(numberIsPositiveInteger(limit));
  console.assert(limit > 0);

  // This does two layers of filtering. It would preferably but one but
  // a three property index involving a date gets complicated. Given the
  // perf is not top priority this is acceptable for now. The first filter
  // layer is at the indexedDB level, and the second is the in memory predicate.
  // The first reduces the number of entries loaded by a large amount.

  return new Promise(function executor(resolve, reject) {
    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;
      if(predicate(entry)) {
        entries.push(entry);
        if(entries.length === limit) {
          return;
        }
      }

      cursor.continue();
    };
  });
}

function readerDbGetUnarchivedUnreadEntries(conn, offset, limit) {
  console.assert(indexedDBIsOpen(conn));

  return new Promise(function executor(resolve, reject) {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const isLimited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = function(event) {
      resolve(entries);
    };
    tx.onerror = function(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(isLimited && ++counter < limit) {
            cursor.continue();
          }
        }
      }
    };
  });
}

function readerDbRemoveFeedAndEntries(conn, feedId, entryIds) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(feedIsValidId(feedId));
  console.assert(Array.isArray(entryIds));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    feedStore.delete(feedId);

    const entryStore = tx.objectStore('entry');
    for(const entryId of entryIds) {
      entryStore.delete(entryId);
    }
  });
}

// This does not validate the entry, it just puts it as is
function readerDbPutEntry(conn, entry) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(entryIsEntry(entry));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function readerDbPutEntries(conn, entries) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(Array.isArray(entries));

  // TODO: this should not be setting dateUpdated that is caller's
  // responsibility

  return new Promise(function executor(resolve, reject) {
    const currentDate = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = function txOnerror(event) {
      reject(tx.error);
    };
    const entryStore = tx.objectStore('entry');
    for(const entry of entries) {
      entry.dateUpdated = currentDate;
      entryStore.put(entry);
    }
  });
}

// Adds or overwrites a feed in storage. Resolves with the new feed id if add.
// There are no side effects other than the database modification.
// @param conn {IDBDatabase} an open database connection
// @param feed {Object} the feed object to add
function readerDbPutFeed(conn, feed) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(feedIsFeed(feed));

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
function readerDbRemoveEntries(conn, ids) {
  console.assert(indexedDBIsOpen(conn));
  console.assert(Array.isArray(ids));

  return new Promise(function executor(resolve, reject) {
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(const id of ids) {
      store.delete(id);
    }
  });
}
