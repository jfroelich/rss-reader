import {entry_is_valid_id, ENTRY_MAGIC, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/app/objects/entry.js';
import {feed_is_valid_id, FEED_MAGIC} from '/src/app/objects/feed.js';
import {get_feeds} from '/src/app/operations/get-feeds.js';
import {idb_open} from '/src/idb/idb.js';

// Open a connection to the reader database. All parameters are optional
export function open(name = 'reader', version = 24, timeout = 500) {
  return idb_open(name, version, on_upgrade_needed, timeout);
}

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version
// number.
function on_upgrade_needed(event) {
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  console.log(
      'Upgrading database %s to version %s from version', conn.name,
      conn.version, event.oldVersion);

  if (event.oldVersion < 20) {
    feed_store =
        conn.createObjectStore('feed', {key_path: 'id', autoIncrement: true});
    entry_store =
        conn.createObjectStore('entry', {key_path: 'id', autoIncrement: true});
    feed_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});

    entry_store.createIndex('readState', 'readState');
    entry_store.createIndex('feed', 'feed');
    entry_store.createIndex(
        'archiveState-readState', ['archiveState', 'readState']);
    entry_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  } else {
    feed_store = txn.objectStore('feed');
    entry_store = txn.objectStore('entry');
  }

  if (event.oldVersion < 21) {
    add_magic_to_entries(txn);
  }

  if (event.oldVersion < 22) {
    add_magic_to_feeds(txn);
  }

  if (event.oldVersion < 23) {
    if (feed_store.indexNames.contains('title')) {
      feed_store.deleteIndex('title');
    }
  }

  if (event.oldVersion < 24) {
    add_active_field_to_feeds(feed_store);
  }
}

// Walk over the entry store one entry at a time and set the magic property for
// each entry. This returns prior to the operation completing.
// @param txn {IDBTransaction}
// @return {void}
function add_magic_to_entries(txn) {
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = function() {
    const cursor = request.result;
    if (cursor) {
      const entry = cursor.value;
      if (!('magic' in entry)) {
        entry.magic = ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
    }
  };
  request.onerror = () => console.error(request.error);
}

// TODO: use cursor over getAll for scalability
function add_magic_to_feeds(txn) {
  console.debug('Adding feed magic');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = console.error;
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

// TODO: use cursor rather than getAll for scalability
function add_active_field_to_feeds(store) {
  const feeds_request = store.getAll();
  feeds_request.onerror = console.error;
  feeds_request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}

// Returns an array of active feeds
export async function find_active_feeds(conn) {
  assert(conn instanceof IDBDatabase);
  const feeds = await get_feeds(conn);
  return feeds.filter(feed => feed.active);
}

// Calls the callback function on each feed in the store
// TODO: currently each call to the callback is blocked by waiting for the
// prior callback to complete, essentially a serial progression. This should
// directly interact with the database instead of using get_feeds and
// pre-loading into an array, and this should walk the feed store and call the
// callback per cursor walk, advancing the cursor PRIOR to calling the callback,
// taking advantage of the asynchronous nature of indexedDB cursor request
// callbacks. This will yield a minor speedup at the cost of being a mild DRY
// violation. However, the speed is admittedly not that important. This will
// also make the approach scalable to N feeds (until stack overflow).

export async function for_each_active_feed(conn, per_feed_callback) {
  const feeds = await get_feeds(conn);
  for (const feed of feeds) {
    per_feed_callback(feed);
  }
}

export function contains_entry_with_url(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = _ => resolve(entry_is_valid_id(request.result));
    request.onerror = _ => reject(request.error);
  });
}

export function find_feed_by_id(conn, id) {
  return new Promise((resolve, reject) => {
    assert(feed_is_valid_id(id));
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.get(id);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

export function contains_feed_with_url(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => {
      const feed_id = request.result;
      resolve(feed_is_valid_id(feed_id));
    };
    request.onerror = () => reject(request.error);
  });
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}
