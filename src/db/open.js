import * as indexeddb from '/src/base/indexeddb.js';

import * as types from './types.js';

// Return a new session without a channel
export async function open(name = 'reader', version = 25, timeout = 500) {
  const session = new DbSession();
  session.conn =
      await indexeddb.open(name, version, on_upgrade_needed, timeout);
  return session;
}

class DbSession {
  constructor() {
    this.conn = undefined;
    this.channel = undefined;
  }

  close() {
    if (this.channel) {
      this.channel.close();
    }

    if (this.conn) {
      this.conn.close();
    }

    // 'Nullify' the props to force errors in places that use props incorrectly
    // Set to undefined instead of delete to maintain v8 object shape
    this.channel = undefined;
    this.conn = undefined;
  }
}

function on_upgrade_needed(event) {
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  // TODO: only print this if verbose flag is set or something like that,
  // otherwise this needlessly spams the test console
  // console.debug(
  //    'Creating or upgrading database from version %d to %d',
  //    event.oldVersion, conn.version);

  // NOTE: event.oldVersion is 0 when the database is being created
  // NOTE: use conn.version to get the current version

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

  // Only do this if not creating
  if (event.oldVersion > 0 && event.oldVersion < 21) {
    add_magic_to_entries(txn);
  }

  // Only do this if not creating
  if (event.oldVersion > 0 && event.oldVersion < 22) {
    add_magic_to_feeds(txn);
  }

  if (event.oldVersion < 23) {
    if (feed_store.indexNames.contains('title')) {
      feed_store.deleteIndex('title');
    }
  }

  // Only do this if not creating
  if (event.oldVersion > 0 && event.oldVersion < 24) {
    add_active_field_to_feeds(feed_store);
  }

  // Handle upgrading to or past version 25 from all prior versions
  if (event.oldVersion < 25) {
    // Create an index on feed id and read state. This enables fast querying
    // of unread entries per feed.
    entry_store.createIndex('feed-readState', ['feed', 'readState']);
  }
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
        entry.magic = types.ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
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
      feed.magic = types.FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

function add_active_field_to_feeds(store) {
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
