import * as Model from '/src/model/model.js';
import sizeof from '/src/lib/sizeof.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';

// This module is an indexedDB specific implementation of the model access
// layer. This does not do channeled communications. This module should not
// be accessed directly, usually should go through model-access module, and
// model-access should be the only module that calls this.

export function activate_feed(conn, feed_id) {
  return new Promise(activate_feed_executor.bind(null, conn, feed_id));
}

function activate_feed_executor(conn, feed_id, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => {
    reject(event.target.error);
  };

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = _ => {
    const feed = request.result;
    if (!Model.is_feed(feed)) {
      reject(new Error('Loaded feed is not a feed ' + feed_id));
      return;
    }

    if (feed.active) {
      reject(new Error('Feed is already active ' + feed_id));
      return;
    }

    delete feed.deactivationReasonText;
    delete feed.deactivateDate;
    feed.active = true;
    feed.dateUpdated = new Date();
    request.source.put(feed);
  };
}

export function archive_entries(conn, max_age) {
  return new Promise(archive_entries_executor.bind(null, conn, max_age));
}

function archive_entries_executor(conn, max_age, resolve, reject) {
  const entry_ids = [];
  const txn = conn.transaction('entry', 'readwrite');
  txn.oncomplete = _ => resolve(entry_ids);
  txn.onerror = event => reject(event.target.error);

  const store = txn.objectStore('entry');
  const index = store.index('archiveState-readState');
  const key_path = [Model.ENTRY_STATE_UNARCHIVED, Model.ENTRY_STATE_READ];
  const request = index.openCursor(key_path);

  request.onsuccess = event => {
    const cursor = event.target.result;
    if (!cursor) {
      return;
    }
    const entry = cursor.value;

    // TODO: abort the transaction? reject and return?
    if (!Model.is_entry(entry)) {
      console.warn('Not an entry', entry);
      cursor.continue();
      return;
    }

    if (!entry.dateCreated) {
      console.warn('No date created', entry);
      cursor.continue();
      return;
    }

    const current_date = new Date();
    const age = current_date - entry.dateCreated;

    if (age < 0) {
      console.warn('Future entry', entry);
      cursor.continue();
      return;
    }

    if (age > max_age) {
      const ae = archive_entry(entry);
      cursor.update(ae);
      entry_ids.push(ae.id);
    }

    cursor.continue();
  };
}

function archive_entry(entry) {
  const before_size = sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = sizeof(ce);

  if (after_size > before_size) {
    console.warn('Entry increased size', entry);
  }

  ce.archiveState = Model.ENTRY_STATE_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = Model.create_entry();
  ce.dateCreated = entry.dateCreated;

  if (entry.dateRead) {
    ce.dateRead = entry.dateRead;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;
  return ce;
}

// TODO: now that create_entry is within this layer and we have an extra layer
// on top of it, and we no longer care about channel message type, it might make
// sense to reuse create and update code
export function create_entry(conn, entry) {
  return new Promise(create_entry_executor.bind(null, conn, entry));
}

function create_entry_executor(conn, entry, resolve, reject) {
  // Resolve on transaction completion, not request completion, to ensure the
  // data is committed and not dishonestly report the result.
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
  const request = index.count(Model.ENTRY_STATE_UNREAD);
  request.onsuccess = _ => resolve(request.result);
  request.onerror = _ => reject(request.error);
}

export function deactivate_feed(conn, feed_id, reason) {
  return new Promise(
      deactivate_feed_executor.bind(null, conn, feed_id, reason));
}

function deactivate_feed_executor(conn, feed_id, reason) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.oncomplete = resolve;
  txn.onerror = event => reject(event.target.error);

  const store = txn.objectStore('feed');
  const request = store.get(feed_id);
  request.onsuccess = _ => {
    const feed = request.result;

    // Errors thrown in a later tick do not cause rejection
    if (!Model.is_feed(feed)) {
      reject(new Error('Loaded feed is not a feed ' + feed_id));
      return;
    }

    if (feed.active !== true) {
      reject(new Error('Cannot deactivate inactive feed ' + feed_id));
      return;
    }

    const current_date = new Date();
    feed.deactivationReasonText = reason;
    feed.deactivateDate = current_date;
    feed.active = false;
    feed.dateUpdated = current_date;
    request.source.put(feed);
  };
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
    const path = [Model.ENTRY_STATE_UNARCHIVED, Model.ENTRY_STATE_UNREAD];
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

    // If an offset was specified and we did not yet advance, then seek
    // forward. Ignore the value at the current position.
    if (offset && !advanced) {
      advanced = true;
      cursor.advance(offset);
      return;
    }

    entries.push(cursor.value);

    // Stop if limit defined and reached or surpassed limit.
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

function get_entry_executor(conn, mode, value, key_only) {
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
      if (Model.is_valid_entry_id(entry_id)) {
        entry = Model.create_entry();
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

      // only define if matched, otherwise leave undef
      if (Model.is_valid_feed_id(feed_id)) {
        feed = Model.create_feed();
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

    // Errors thrown in a later tick do not cause rejection. Therefore it is
    // unsafe to call this without trapping errors because we cannot rely on
    // the caller to carefully craft the handle_entry callback.
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

    // Errors thrown in a later tick do not cause rejection
    if (!Model.is_entry(entry)) {
      reject(new Error('Loaded object is not an entry ' + entry_id));
      return;
    }

    if (entry.archiveState === Model.ENTRY_STATE_ARCHIVED) {
      reject(new Error('Cannot mark archived entry as read ' + entry_id));
      return;
    }

    if (entry.readState === Model.ENTRY_STATE_READ) {
      reject(new Error('Cannot mark read entry as read ' + entry_id));
      return;
    }

    entry.readState = Model.ENTRY_STATE_READ;
    const currentDate = new Date();
    entry.dateUpdated = currentDate;
    entry.dateRead = currentDate;

    request.source.put(entry);
  };
}

export function open(name, version, upgrade = on_upgrade_needed, timeout) {
  return indexeddb.open(name, version, upgrade, timeout);
}

function on_upgrade_needed(event) {
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  // Some simple debugging. If creating a brand new database, old_version
  // is expected to be 0 (and not NaN/null/undefined).
  console.debug('Creating/upgrading database', JSON.stringify({
    name: conn.name,
    old_version: event.oldVersion,
    new_version: conn.version
  }));

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
        entry.magic = Model.ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
    }
  };
  request.onerror = _ => console.error(request.error);
}

// TODO: use cursor over getAll for scalability
function add_magic_to_feeds(txn) {
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = Model.FEED_MAGIC;
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

    if (!Model.is_entry(entry)) {
      console.warn('Loaded entry is not an entry ' + JSON.stringify(entry));
      return;
    }

    if (Model.is_valid_feed_id(entry.feed)) {
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
    if (!Model.is_feed(feed)) {
      removed_feed_ids.push(feed.id);
      const promise = delete_feed(conn, feed.id);
      delete_feed_promises.push(promise);
    }
  }

  // We plan to process more entries later in this function, so we block here
  // to ensure entries are deleted and not re-processed later.
  const results = await Promise.all(delete_feed_promises);

  // Each delete_feed promise resolves to an array of 0 or more deleted entry
  // ids. These entries were deleted by virtue of deleting their feed.
  for (const entry_ids of results) {
    for (const id of entry_ids) {
      removed_entry_ids.push(id);
    }
  }

  // But these entries are deleted without considering the feed.
  await this.iterateEntries(conn, cursor => {
    const entry = cursor.value;
    if (!Model.is_entry(entry)) {
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

export function update_feed(conn, feed) {
  return new Promise(update_feed_executor.bind(null, conn, feed));
}

function update_feed_executor(conn, feed, resolve, reject) {
  const txn = conn.transaction('feed', 'readwrite');
  txn.onerror = event => reject(event.target.error);
  txn.oncomplete = resolve;
  txn.objectStore('feed').put(feed);
}
