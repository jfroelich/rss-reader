import assert from '/src/assert/assert.js';
import * as entry_utils from '/src/db/entry-utils.js';
import * as feed_utils from '/src/db/feed-utils.js';
import * as types from '/src/db/types.js';
import * as indexeddb from '/src/indexeddb/indexeddb.js';

export function create_entry(conn, entry) {
  return new Promise(create_entry_executor.bind(null, conn, entry));
}

function create_entry_executor(conn, entry, resolve, reject) {
  let id;
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = _ => resolve(id);
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');
  const request = store.put(entry);
  request.onsuccess = _ => id = request.result;
}

export function create_feed(conn, feed) {
  return new Promise(create_feed_executor.bind(null, conn, feed));
}

function create_feed_executor(conn, feed, resolve, reject) {
  let id = 0;
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(id);
  const store = txn.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = _ => id = request.result;
}

export function create_feeds(conn, feeds) {
  return new Promise(create_feeds_executor.bind(null, conn, feeds));
}

function create_feeds_executor(conn, feeds, resolve, reject) {
  const ids = [];
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(ids);

  function request_onsuccess(event) {
    ids.push(event.target.result);
  }

  const store = txn.objectStore('feed');
  for (const feed of feeds) {
    const request = store.put(feed);
    request.onsuccess = request_onsuccess;
  }
}

export function count_unread_entries(conn) {
  return new Promise(count_unread_entries_executor.bind(null, conn));
}

function count_unread_entries_executor(conn, resolve, reject) {
  const txn = conn.transaction('entry');
  const store = txn.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(entry_utils.ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}

export function deactivate_feed(conn, feed_id, reason) {
  function transition(feed) {
    if (!feed.active) {
      throw new Error('Cannot deactivate inactive feed with id ' + feed.id);
    }

    const now = new Date();
    feed.deactivationReasonText = reason;
    feed.deactivateDate = now;
    feed.dateUpdated = now;
    feed.active = false;
    return feed;
  }

  return update_feed(conn, {id: feed_id}, transition);
}

export function delete_entry(conn, entry_id) {
  return new Promise(delete_entry_executor.bind(null, conn, entry_id));
}

function delete_entry_executor(conn, entry_id, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  txn.objectStore('entry').delete(entry_id);
}

export function delete_feed(conn, feed_id) {
  return new Promise(delete_feed_executor.bind(null, conn, feed_id));
}

function delete_feed_executor(conn, feed_id, resolve, reject) {
  const entry_ids = [];
  const txn = conn.transaction(['feed', 'entry'], 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = _ => resolve(entry_ids);

  const feed_store = txn.objectStore('feed');
  feed_store.delete(feed_id);

  const entry_store = txn.objectStore('entry');
  const feed_index = entry_store.index('feed');
  const request = feed_index.getAllKeys(feed_id);
  request.onsuccess = _ => {
    const keys = request.result;
    for (const id of keys) {
      entry_ids.push(id);
      entry_store.delete(id);
    }
  };
}

export function get_entries(conn, mode, offset, limit) {
  return new Promise(
      get_entries_executor.bind(null, conn, mode, offset, limit));
}

function get_entries_executor(conn, mode, offset, limit, resolve, reject) {
  const entries = [];
  let advanced = false;

  const txn = conn.transaction('entry');
  txn.oncomplete = _ => resolve(entries);
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');

  let request;
  if (mode === 'viewable') {
    const index = store.index('archiveState-readState');
    const path =
        [entry_utils.ENTRY_STATE_UNARCHIVED, entry_utils.ENTRY_STATE_UNREAD];
    request = index.openCursor(path);
  } else if (mode === 'all') {
    request = store.openCursor();
  } else {
    throw new TypeError('Invalid mode ' + mode);
  }

  request.onsuccess = _ => {
    const cursor = request.result;
    if (!cursor) {
      return;
    }

    if (offset && !advanced) {
      advanced = true;
      cursor.advance(offset);
      return;
    }

    entries.push(cursor.value);

    if (limit > 0 && entries.length >= limit) {
      return;
    }

    cursor.continue();
  };
}

export function get_entry(conn, mode, value, key_only) {
  return new Promise(
      get_entry_executor.bind(null, conn, mode, value, key_only));
}

function get_entry_executor(conn, mode, value, key_only, resolve, reject) {
  const txn = conn.transaction('entry');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');

  let request;
  if (mode === 'url') {
    const index = store.index('urls');
    const href = value.href;
    request = key_only ? index.getKey(href) : index.get(href);
  } else if (mode === 'id') {
    request = store.get(value);
  } else {
    throw new TypeError('Invalid mode ' + mode);
  }

  request.onsuccess = _ => {
    let entry;
    if (key_only) {
      const entry_id = request.result;
      if (entry_utils.is_valid_entry_id(entry_id)) {
        entry = entry_utils.create_entry();
        entry.id = entry_id;
      }
    } else {
      entry = request.result;
    }

    resolve(entry);
  };
}

export function get_feed_ids(conn) {
  return new Promise(get_feed_ids_executor.bind(null, conn));
}

function get_feed_ids_executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('feed');
  const request = store.getAllKeys();
  request.onsuccess = _ => resolve(request.result);
}

export function get_feed(conn, mode, value, key_only) {
  return new Promise(get_feed_executor.bind(null, conn, mode, value, key_only));
}

function get_feed_executor(conn, mode, value, key_only, resolve, reject) {
  const txn = conn.transaction('feed');
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('feed');

  let request;
  if (mode === 'url') {
    const index = store.index('urls');
    const href = value.href;
    request = key_only ? index.getKey(href) : index.get(href);
  } else if (mode === 'id') {
    request = store.get(value);
  } else {
    throw new TypeError('Invalid mode ' + mode);
  }

  request.onsuccess = _ => {
    let feed;
    if (key_only) {
      const feed_id = request.result;
      if (feed_utils.is_valid_feed_id(feed_id)) {
        feed = feed_utils.create_feed();
        feed.id = feed_id;
      }
    } else {
      feed = request.result;
    }

    resolve(feed);
  };
}

export function get_feeds(conn) {
  return new Promise(get_feeds_executor.bind(null, conn));
}

function get_feeds_executor(conn, resolve, reject) {
  const txn = conn.transaction('feed');
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => reject(request.error);
  request.onsuccess = _ => resolve(request.result);
}

export function iterate_entries(conn, handle_entry) {
  return new Promise(iterate_entries_executor.bind(null, conn, handle_entry));
}

function iterate_entries_executor(conn, handle_entry, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);
  const store = txn.objectStore('entry');
  const request = store.openCursor();

  request.onsuccess = _ => {
    const cursor = request.result;
    if (!cursor) {
      return;
    }

    try {
      handle_entry(cursor);
    } catch (error) {
      console.warn(error);
    }

    cursor.continue();
  };
}

export function mark_entry_read(conn, entry_id) {
  return new Promise(mark_entry_read_executor.bind(null, conn, entry_id));
}

function mark_entry_read_executor(conn, entry_id, resolve, reject) {
  const txn = conn.transaction('entry', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;

  const store = txn.objectStore('entry');
  const request = store.get(entry_id);
  request.onsuccess = _ => {
    const entry = request.result;

    if (!types.is_entry(entry)) {
      reject(new Error('Loaded object is not an entry ' + entry_id));
      return;
    }

    if (entry.archiveState === entry_utils.ENTRY_STATE_ARCHIVED) {
      reject(new Error('Cannot mark archived entry as read ' + entry_id));
      return;
    }

    if (entry.readState === entry_utils.ENTRY_STATE_READ) {
      reject(new Error('Cannot mark read entry as read ' + entry_id));
      return;
    }

    entry.readState = entry_utils.ENTRY_STATE_READ;
    const currentDate = new Date();
    entry.dateUpdated = currentDate;
    entry.dateRead = currentDate;

    request.source.put(entry);
  };
}

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

  await this.iterateEntries(conn, cursor => {
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
