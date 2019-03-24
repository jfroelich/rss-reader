import Connection from '/src/db/connection.js';
import * as types from '/src/db/types.js';
import assert from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';

// Asynchronously connect to the indexedDB database
// @param name {String} the name of the database
// @param version {Number} the version of the database
// @param upgrade_handler {Function}
// @param timeout {Deadline} optional
// @param channel_name {String} optional, the channel to send messages, defaults
// to 'reader'. Normal usage should leave as is, tests should use some name
// other than the default.
// @param channel_class {Function} optional, the class of the channel, defaults
// to {BroadcastChannel}
// @return {Promise} a promise that resolves to a connection {Connection}
export default async function open(
    name = 'reader', version = 29, upgrade_handler = default_upgrade_handler,
    timeout = INDEFINITE, channel_name = 'reader',
    channel_class = BroadcastChannel) {
  const conn = new Connection();
  conn.channel = new channel_class(channel_name);
  conn.conn = await indexeddb_utils.open(
      name, version, upgrade_handler.bind(null, conn.channel), timeout);
  return conn;
}

function default_upgrade_handler(channel, event) {
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
    add_magic_to_entries(txn, channel);
  }

  if (event.oldVersion > 0 && event.oldVersion < 22) {
    add_magic_to_feeds(txn, channel);
  }

  if (event.oldVersion > 0 && event.oldVersion < 23) {
    feed_store.deleteIndex('title');
  }

  if (event.oldVersion > 0 && event.oldVersion < 24) {
    add_active_field_to_feeds(txn, channel);
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
      ensure_entries_have_date_published(txn, channel);
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

// TODO: send proper channel messages
function ensure_entries_have_date_published(txn, channel) {
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

// TODO: send proper channel messages
function add_magic_to_entries(txn, channel) {
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
      cursor.continue();
    }
  };
}

// TODO: send proper channel messages
function add_magic_to_feeds(txn, channel) {
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
  };
}

// TODO: send proper channel messages
function add_active_field_to_feeds(txn, channel) {
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
