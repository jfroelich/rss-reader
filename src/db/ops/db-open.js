import {assert} from '/src/assert.js';
import {Deadline, INDEFINITE} from '/src/deadline.js';
import * as indexeddb_utils from '/src/indexeddb-utils/indexeddb-utils.js';
import * as magic from '/src/db/types/magic.js';

// TODO: rename feed object store to feeds
// TODO: rename entry object store to entries
// channel-name was 'reader'

// Asynchronously connect to the indexedDB database
// @param name {String}
// @param version {Number}
// @param upgrade_handler {Function}
// @param timeout {Deadline} optional
// @return {Promise} a promise that resolves to an {IDBDatabase} instance
export default function db_open(
    name = 'reader', version = 29, upgrade_handler = default_upgrade_handler,
    timeout = INDEFINITE) {
  return indexeddb_utils.open(name, version, upgrade_handler, timeout);
}

function default_upgrade_handler(event) {
  // event.oldVersion is 0 when the database is being created
  // use conn.version to get the current version
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  if (event.oldVersion < 20) {
    const feed_store_props = {keyPath: 'id', autoIncrement: true};
    feed_store = conn.createObjectStore('feed', feed_store_props);
    const entry_store_props = {keyPath: 'id', autoIncrement: true};
    entry_store = conn.createObjectStore('entry', entry_store_props);
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

  if (event.oldVersion > 0 && event.oldVersion < 21) {
    add_magic_to_entries(txn);
  }

  if (event.oldVersion > 0 && event.oldVersion < 22) {
    add_magic_to_feeds(txn);
  }

  if (event.oldVersion > 0 && event.oldVersion < 23) {
    feed_store.deleteIndex('title');
  }

  if (event.oldVersion > 0 && event.oldVersion < 24) {
    add_active_field_to_feeds(txn);
  }

  if (event.oldVersion < 25) {
    // Create an index on feed id and read state. This enables fast querying
    // of unread entries per feed.
    entry_store.createIndex('feed-readState', ['feed', 'readState']);
  }

  // Handle upgrading to or past version 26 from all prior versions.
  // This version adds an index on the entry store on the datePublished
  // property, so that all entries can be loaded sorted by datePublished
  if (event.oldVersion < 26) {
    // If there may be existing entries, then ensure that all older entries
    // have a datePublished
    if (event.oldVersion) {
      ensure_entries_have_date_published(txn);
    }

    entry_store.createIndex('datePublished', 'datePublished');
  }

  // Handle upgrade to 27, or past 27, from all prior versions. This version
  // adds a new index for use in the reader-page view.
  if (event.oldVersion < 27) {
    const index_name = 'readState-datePublished';
    const index_path = ['readState', 'datePublished'];
    entry_store.createIndex(index_name, index_path);
  }

  if (event.oldVersion < 28) {
    const index_name = 'feed-datePublished';
    const index_path = ['feed', 'datePublished'];
    entry_store.createIndex(index_name, index_path);
  }

  if (event.oldVersion < 29) {
    const index_name = 'feed-readState-datePublished';
    const index_path = ['feed', 'readState', 'datePublished'];
    entry_store.createIndex(index_name, index_path);
  }
}

function ensure_entries_have_date_published(txn) {
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = event => {
    const cursor = request.result;
    if (cursor) {
      const entry = cursor.value;
      if (!entry.datePublished) {
        entry.datePublished = entry.dateCreated;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
      cursor.continue();
    }
  };
}

function add_magic_to_entries(txn) {
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function() {
    const cursor = request.result;
    if (cursor) {
      const entry = cursor.value;
      if (!('magic' in entry)) {
        entry.magic = magic.ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
      cursor.continue();
    }
  };
}

function add_magic_to_feeds(txn) {
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = magic.FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}

function add_active_field_to_feeds(txn) {
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}
