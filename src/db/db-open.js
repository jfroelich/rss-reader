import {config_db_name, config_db_open_timeout, config_db_version} from '/src/config.js';
import {ENTRY_MAGIC} from '/src/entry.js';
import {FEED_MAGIC} from '/src/feed.js';
import {console_stub} from '/src/lib/console-stub.js';
import {indexeddb_open} from '/src/lib/indexeddb/indexeddb-open.js';

// Opens a connection to the reader database.
//
// Notes:
// * If the database does not exist, it will be created
// * Optionally specify a timeout to limit how long to wait before considering
// the attempt to connect to the database a failure
// * The name and version parameters are both optional. If not specified, then
// the call connects to the hardcoded default database. About the only reason to
// ever specify non-default values is for testing.
// TODO: tests
// TODO: rather than default to config, maybe I should just export the
// on_upgrade_needed handler too? The only alternate user other than the normal
// app usage is the test context, and the test context is privy too using
// indexeddb_open, it just cannot use the upgrade handler here, for now, because
// it is module-private.

export function db_open(name, version, timeout, console = console_stub) {
  // Default to config values. These are not fully hardcoded so that the
  // function can still be easily overloaded in order to reuse the
  // on_upgrade_needed handler with a different database name and version.
  name = name || config_db_name;
  version = isNaN(version) ? config_db_version : version;
  timeout = isNaN(timeout) ? config_db_open_timeout : timeout;

  const upgrade_bound = on_upgrade_needed.bind(this, console);
  return indexeddb_open(name, version, upgrade_bound, timeout, console);
}

function on_upgrade_needed(console, event) {
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  if (event.oldVersion === 0) {
    console.log(
        '%s: creating database', on_upgrade_needed.name, conn.name,
        conn.version, event.oldVersion);
  } else {
    console.log(
        '%s: upgrading database %s to version %s from version',
        on_upgrade_needed.name, conn.name, conn.version, event.oldVersion);
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
    add_magic_to_entries(txn, console);
  }

  if (event.oldVersion < 22) {
    add_magic_to_feeds(txn, console);
  }

  if (event.oldVersion < 23) {
    if (feed_store.indexNames.contains('title')) {
      feed_store.deleteIndex('title');
    }
  }

  if (event.oldVersion < 24) {
    add_active_field_to_feeds(feed_store, console);
  }
}

// Walk over the entry store one entry at a time and set the magic property for
// each entry. This returns prior to the operation completing.
// @param txn {IDBTransaction}
// @return {void}
function add_magic_to_entries(txn, console) {
  console.debug('Adding entry magic');
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
function add_magic_to_feeds(txn, console) {
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
function add_active_field_to_feeds(store, console) {
  console.debug('Adding active property to older feeds');
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
