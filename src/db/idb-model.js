import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as feed_utils from '/src/db/feed-utils.js';
import {delete_feed} from '/src/db/op/delete-feed.js';
import {get_feed_ids} from '/src/db/op/get-feed-ids.js';
import {get_feeds} from '/src/db/op/get-feeds.js';
import {iterate_entries} from '/src/db/op/iterate-entries.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';

export function open(name, version, upgrade = on_upgrade_needed, timeout) {
  return indexeddb.open(name, version, upgrade, timeout);
}

// NOTE: if new db, then event.oldVersion is 0, and conn.version is the new
// version value.
function on_upgrade_needed(event) {
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
  const store = txn.objectStore('entry');
  const request = store.openCursor();
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
  request.onerror = _ => console.error(request.error);
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

export async function remove_lost_entries(conn) {
  const deleted_ids = [];
  await iterate_entries(conn, cursor => {
    const entry = cursor.value;
    if (!entry.urls || !entry.urls.length) {
      cursor.delete();
      deleted_ids.push(entry.id);
    }
  });
  return deleted_ids;
}

export async function remove_orphaned_entries(conn) {
  const entry_ids = [];
  const feed_ids = await get_feed_ids(conn);
  if (!feed_ids.length) {
    return entry_ids;
  }

  await iterate_entries(conn, cursor => {
    const entry = cursor.value;

    if (!types.is_entry(entry)) {
      console.warn('Loaded entry is not an entry ' + JSON.stringify(entry));
      return;
    }

    if (feed_utils.is_valid_feed_id(entry.feed)) {
      return;
    }

    if (feed_ids.includes(entry.feed)) {
      return;
    }

    entry_ids.push(entry.id);
    cursor.delete();
  });

  return entry_ids;
}

export async function remove_untyped_objects(conn) {
  const removed_feed_ids = [];
  const removed_entry_ids = [];

  const feeds = get_feeds(conn);
  const delete_feed_promises = [];
  for (const feed of feeds) {
    if (!types.is_feed(feed)) {
      removed_feed_ids.push(feed.id);
      const promise = delete_feed(conn, feed.id);
      delete_feed_promises.push(promise);
    }
  }

  const results = await Promise.all(delete_feed_promises);
  for (const entry_ids of results) {
    for (const id of entry_ids) {
      removed_entry_ids.push(id);
    }
  }

  await iterate_entries(conn, cursor => {
    const entry = cursor.value;
    if (!types.is_entry(entry)) {
      removed_entry_ids.push(entry.id);
      cursor.delete();
    }
  });

  return {feed_ids: removed_feed_ids, entry_ids: removed_entry_ids};
}

export function update_entry(conn, entry) {
  return new Promise(update_entry_executor.bind(null, conn, entry));
}

function update_entry_executor(conn, entry, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  txn.objectStore('entry').put(entry);
}

export function update_feed(conn, feed, transition) {
  return new Promise(update_feed_executor.bind(null, conn, feed, transition));
}

function update_feed_executor(conn, feed, transition, resolve, reject) {
  assert(transition === undefined || typeof transition === 'function');

  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;
  const store = txn.objectStore('feed');

  if (!transition) {
    store.put(feed);
    return;
  }

  // Read, transition, then overwrite
  const find_request = store.get(feed.id);
  find_request.onsuccess = event => {
    const old_feed = event.target.result;
    if (!old_feed) {
      const msg = 'Failed to find feed to update for id ' + feed.id;
      const err = new Error(msg);
      reject(err);
      return;
    }

    if (!types.is_feed(old_feed)) {
      const msg = 'Matched object is not of type feed for id ' + feed.id;
      const err = new Error(msg);
      reject(err);
      return;
    }

    // NOTE: the reason for the try/catch is that this exception otherwise
    // occurs in a deferred setting and is not automatically converted into a
    // rejection

    let new_feed;
    try {
      new_feed = transition(old_feed);
    } catch (error) {
      reject(error);
      return;
    }

    if (!types.is_feed(new_feed)) {
      reject(
          'Transitioning feed did not produce a valid feed object for id ' +
          feed.id);
      return;
    }

    store.put(new_feed);
  };
}
