import {assert} from '/src/assert/assert.js';
import * as config_control from '/src/control/config-control.js';
import * as Entry from '/src/data-layer/entry.js';
import * as Feed from '/src/data-layer/feed.js';
import {filter_empty_properties} from '/src/lang/filter-empty-properties.js';

export function activate_feed(conn, channel, feed_id) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-activated', id: feed_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(Feed.is_feed(feed));
      assert(feed.active !== true);
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
      feed.active = true;
      feed.dateUpdated = new Date();
      request.source.put(feed);
    };
  });
}

export function count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

export function deactivate_feed(conn, channel, feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-deactivated', id: feed_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(Feed.is_feed(feed));
      assert(feed.active !== false);
      const current_date = new Date();
      feed.deactivationReasonText = reason;
      feed.deactivateDate = current_date;
      feed.active = false;
      feed.dateUpdated = current_date;
      request.source.put(feed);
    };
  });
}

export function delete_entry(conn, channel, id, reason) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_entry_id(id));  // prevent fake noops
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      // Unlike delete_feed this does not expose feed id because it would
      // require an extra lookup.
      const msg = {type: 'entry-deleted', id: id, reason: reason};
      channel.postMessage(msg);
      resolve();
    };
    txn.onerror = _ => reject(txn.error);
    txn.objectStore('entry').delete(id);
  });
}

// Remove a feed and its entries, posts a message for each removal.
// If feed id does not exist then no error is thrown this is just a noop.
export function delete_feed(conn, channel, feed_id, reason) {
  return new Promise((resolve, reject) => {
    // If not checked this would be a noop which is misleading
    assert(Feed.is_valid_id(feed_id));

    const entry_ids = [];
    const txn = conn.transaction(['feed', 'entry'], 'readwrite');
    txn.oncomplete = _ => {
      let msg = {type: 'feed-deleted', id: feed_id, reason: reason};
      post_message(msg);
      msg = {type: 'entry-deleted', id: 0, reason: reason, feed_id: feed_id};
      for (const id of entry_ids) {
        msg.id = id;
        channel.postMessage(msg);
      }
      resolve();
    };

    txn.onerror = _ => reject(txn.error);

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
  });
}


export function get_entries(conn, mode = 'all', offset = 0, limit = 0) {
  return new Promise((resolve, reject) => {
    assert(
        offset === null || typeof offset === 'undefined' || offset === NaN ||
        (Number.isInteger(offset) && offset >= 0));
    assert(
        limit === null || typeof limit === 'undefined' || limit === NaN ||
        (Number.isInteger(limit) && limit >= 0));

    const entries = [];
    let advanced = false;

    const txn = conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archiveState-readState');
      const path = [Entry.ENTRY_STATE_UNARCHIVED, Entry.ENTRY_STATE_UNREAD];
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
  });
}

export function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || Entry.is_valid_entry_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('entry');
    txn.onerror = _ => reject(txn.error);
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
        if (Entry.is_valid_entry_id(entry_id)) {
          entry = Entry.create_entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}

export function get_feed_ids(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
}


// Find a feed in the database by id or by url
export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || Feed.is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
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
        if (Feed.is_valid_id(feed_id)) {
          feed = Feed.create();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}

export function get_feeds(conn, mode = 'all', sort = false) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();
    request.onerror = _ => reject(request.error);
    request.onsuccess = _ => {
      const feeds = request.result;
      if (sort) {
        feeds.sort(compare_feeds);
      }

      if (mode === 'active') {
        resolve(feeds.filter(feed => feed.active));
      } else {
        resolve(feeds);
      }
    };
  });
}

function compare_feeds(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

export function iterate_entries(conn, mode = 'all', writable, handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');

    const txn_mode = writable ? 'readwrite' : 'readonly';
    const txn = conn.transaction('entry', txn_mode);
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'archive') {
      const index = store.index('archiveState-readState');
      const key_path = [Entry.ENTRY_STATE_UNARCHIVED, Entry.ENTRY_STATE_READ];
      request = index.openCursor(key_path);
    } else if (mode === 'all') {
      request = store.openCursor();
    } else {
      throw new Error('Invalid mode ' + mode);
    }

    request.onsuccess = _ => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      handle_entry(cursor);
      cursor.continue();
    };
  });
}


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

export function update_entry(conn, channel, entry) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_entry(entry));

    const creating = !entry.id;
    if (creating) {
      entry.readState = Entry.ENTRY_STATE_UNREAD;
      entry.archiveState = Entry.ENTRY_STATE_UNARCHIVED;
      entry.dateCreated = new Date();
      delete entry.dateUpdated;
    } else {
      entry.dateUpdated = new Date();
    }

    filter_empty_properties(entry);

    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'entry-write', id: entry.id, 'create': creating};
      console.debug(message);
      channel.postMessage(message);
      resolve(entry.id);
    };
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    if (creating) {
      request.onsuccess = _ => entry.id = request.result;
    }
  });
}

export function update_feed(conn, channel, feed) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_feed(feed));
    assert(feed.urls && feed.urls.length);

    filter_empty_properties(feed);

    const is_create = !feed.id;
    if (is_create) {
      feed.active = true;
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    } else {
      feed.dateUpdated = new Date();
    }

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'feed-written', id: feed.id, create: is_create};
      channel.postMessage(message);
      resolve(feed.id);
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.put(feed);

    if (is_create) {
      request.onsuccess = _ => feed.id = request.result;
    }
  });
}
