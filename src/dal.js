import * as config_control from '/src/config.js';
import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import * as object from '/src/lib/object.js';
import * as Entry from '/src/model/entry.js';
import * as Feed from '/src/model/feed.js';

// Provides a data access layer for interacting with the reader database
export function ReaderDAL() {
  this.conn = undefined;
  this.channel = undefined;
}

ReaderDAL.prototype.activateFeed = function(feed_id) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      this.channel.postMessage({type: 'feed-activated', id: feed_id});
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
};

// NOTE: only closes database, not channel
ReaderDAL.prototype.close = function() {
  this.conn.close();
};

ReaderDAL.prototype.countUnreadEntries = function() {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
};

ReaderDAL.prototype.deactivateFeed = function(feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      this.channel.postMessage({type: 'feed-deactivated', id: feed_id});
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
};

ReaderDAL.prototype.deleteEntry = function(entry_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_id(entry_id));
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const msg = {type: 'entry-deleted', id: entry_id, reason: reason};
      this.channel.postMessage(msg);
      resolve();
    };
    txn.onerror = _ => reject(txn.error);
    txn.objectStore('entry').delete(entry_id);
  });
};

ReaderDAL.prototype.deleteFeed = function(feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_valid_id(feed_id));

    const entry_ids = [];
    const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
    txn.onerror = _ => reject(txn.error);
    txn.oncomplete = _ => {
      let msg = {type: 'feed-deleted', id: feed_id, reason: reason};
      this.channel.postMessage(msg);
      msg = {type: 'entry-deleted', id: 0, reason: reason, feed_id: feed_id};
      for (const id of entry_ids) {
        msg.id = id;
        this.channel.postMessage(msg);
      }
      resolve();
    };

    const feed_store = txn.objectStore('feed');
    feed_store.delete(feed_id);

    const entry_store = txn.objectStore('entry');
    const feed_index = entry_store.index('feed');
    const request = feed_index.getAllKeys(feed_id);
    request.onsuccess = _ => {
      const keys = request.result;
      for (const id of keys) {
        entry_ids.push(id);
        request.source.delete(id);
      }
    };
  });
};

ReaderDAL.prototype.getEntries = function(mode = 'all', offset = 0, limit = 0) {
  return new Promise((resolve, reject) => {
    assert(
        offset === null || offset === undefined || offset === NaN ||
        (Number.isInteger(offset) && offset >= 0));
    assert(
        limit === null || limit === undefined || limit === NaN ||
        (Number.isInteger(limit) && limit >= 0));

    const entries = [];
    let advanced = false;

    const txn = this.conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archiveState-readState');
      const path = [Entry.STATE_UNARCHIVED, Entry.STATE_UNREAD];
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
};

ReaderDAL.prototype.getEntry = function(mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || Entry.is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = this.conn.transaction('entry');
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
        if (Entry.is_valid_id(entry_id)) {
          entry = Entry.create();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
};

ReaderDAL.prototype.getFeedIds = function() {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('feed');
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
};

ReaderDAL.prototype.getFeed = function(mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || Feed.is_valid_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = this.conn.transaction('feed');
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
};

ReaderDAL.prototype.getFeeds = function(mode = 'all', sort = false) {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('feed');
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
};

function compare_feeds(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

ReaderDAL.prototype.iterateEntries = function(
    mode = 'all', writable, handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');

    const txn_mode = writable ? 'readwrite' : 'readonly';
    const txn = this.conn.transaction('entry', txn_mode);
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'archive') {
      const index = store.index('archiveState-readState');
      const key_path = [Entry.STATE_UNARCHIVED, Entry.STATE_READ];
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
};

ReaderDAL.prototype.markEntryRead = function(entry_id) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_valid_id(entry_id));

    const txn = this.conn.transaction('entry', 'readwrite');
    txn.onerror = _ => reject(txn.error);
    txn.oncomplete = _ => {
      this.channel.postMessage({type: 'entry-read', id: entry_id});
      resolve();
    };

    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = _ => {
      const entry = request.result;
      assert(Entry.is_entry(entry));
      assert(entry.archiveState !== Entry.STATE_ARCHIVED);
      assert(entry.readState !== Entry.STATE_READ);

      entry.readState = Entry.STATE_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;

      request.source.put(entry);
    };
  });
};

ReaderDAL.prototype.connect = async function(name, version, timeout) {
  this.conn = await this.openDB(name, version, timeout);
};

// TODO: cannot rely on config-control, that is wrong direction of layer dep
ReaderDAL.prototype.openDB = function(name, version, timeout) {
  // Default to config values. These are not fully hardcoded so that the
  // function can still be easily overloaded in order to reuse the
  // on_upgrade_needed handler with a different database name and version.
  name = typeof name === 'string' ? name : localStorage.db_name;
  version = isNaN(version) ? config_control.read_int('db_version') : version;
  timeout =
      isNaN(timeout) ? config_control.read_int('db_open_timeout') : timeout;
  return indexeddb.open(name, version, on_upgrade_needed, timeout);
};

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
        entry.magic = Entry.MAGIC;
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

ReaderDAL.prototype.updateEntry = function(entry) {
  return new Promise((resolve, reject) => {
    assert(Entry.is_entry(entry));

    const creating = !entry.id;
    if (creating) {
      entry.readState = Entry.STATE_UNREAD;
      entry.archiveState = Entry.STATE_UNARCHIVED;
      entry.dateCreated = new Date();
      delete entry.dateUpdated;
    } else {
      entry.dateUpdated = new Date();
    }

    object.filter_empty_properties(entry);

    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'entry-write', id: entry.id, 'create': creating};
      console.debug(message);
      this.channel.postMessage(message);
      resolve(entry.id);
    };
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    if (creating) {
      request.onsuccess = _ => entry.id = request.result;
    }
  });
};

ReaderDAL.prototype.updateFeed = function(feed) {
  return new Promise((resolve, reject) => {
    assert(Feed.is_feed(feed));
    assert(feed.urls && feed.urls.length);

    object.filter_empty_properties(feed);

    const is_create = !feed.id;
    if (is_create) {
      feed.active = true;
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    } else {
      feed.dateUpdated = new Date();
    }

    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = _ => reject(txn.error);
    txn.oncomplete = _ => {
      const message = {type: 'feed-written', id: feed.id, create: is_create};
      this.channel.postMessage(message);
      resolve(feed.id);
    };

    const store = txn.objectStore('feed');
    const request = store.put(feed);
    if (is_create) {
      request.onsuccess = _ => feed.id = request.result;
    }
  });
};
