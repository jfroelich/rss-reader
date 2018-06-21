import * as config_control from '/src/control/config-control.js';
import {indexeddb_open} from '/src/indexeddb/indexeddb-open.js';
import * as Entry from '/src/model/entry.js';
import * as Feed from '/src/model/feed.js';

export function open_db(name, version, timeout) {
  // Default to config values. These are not fully hardcoded so that the
  // function can still be easily overloaded in order to reuse the
  // on_upgrade_needed handler with a different database name and version.
  name = typeof name === 'string' ? name : localStorage.db_name;
  version = isNaN(version) ? config_control.read_int('db_version') : version;
  timeout =
      isNaN(timeout) ? config_control.read_int('db_open_timeout') : timeout;
  return indexeddb_open(name, version, on_upgrade_needed, timeout);
}

function on_upgrade_needed(event) {
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  if (event.oldVersion === 0) {
    console.debug(
        'Creating database', conn.name, conn.version, event.oldVersion);
  } else {
    console.debug(
        'Upgrading database %s to version %s from version', conn.name,
        conn.version, event.oldVersion);
  }

  if (event.oldVersion < 20) {
    const feed_store_props = {keyPath: 'id', autoIncrement: true};
    console.debug('Creating feed object store with props', feed_store_props);
    feed_store = conn.createObjectStore('feed', feed_store_props);

    const entry_store_props = {keyPath: 'id', autoIncrement: true};
    console.debug('Creating entry object store with props', entry_store_props);
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

function add_magic_to_entries(txn) {
  console.debug('Adding entry magic');
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onsuccess = function() {
    const cursor = request.result;
    if (cursor) {
      const entry = cursor.value;
      if (!('magic' in entry)) {
        entry.magic = Entry.ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
    }
  };
  request.onerror = _ => console.error(request.error);
}

// TODO: use cursor over getAll for scalability
function add_magic_to_feeds(txn) {
  console.debug('Adding feed magic');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = Feed.MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

function add_active_field_to_feeds(store) {
  console.debug('Adding active property to older feeds');
  const feeds_request = store.getAll();
  feeds_request.onerror = _ => console.error(feeds_request.error);
  feeds_request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}
