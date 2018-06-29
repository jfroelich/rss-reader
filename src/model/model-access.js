import assert from '/src/lib/assert.js';
import * as indexeddb from '/src/lib/indexeddb.js';
import * as ls from '/src/lib/ls.js';
import * as object from '/src/lib/object.js';
import * as Model from '/src/model/model.js';
import sizeof from '/src/lib/sizeof.js';

// Provides a data access layer for interacting with the reader database
export function ModelAccess() {
  this.conn = undefined;
  this.channel = undefined;
}

ModelAccess.prototype.activateFeed = function(feed_id) {
  return new Promise((resolve, reject) => {
    assert(Model.is_valid_feed_id(feed_id));
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      try {
        this.channel.postMessage({type: 'feed-activated', id: feed_id});
      } catch (error) {
        console.warn(error);
      }

      resolve();
    };
    txn.onerror = event => {
      reject(event.target.error);
    };

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;

      // Errors thrown in a later tick do not cause rejection
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
  });
};

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

// Compacts older read entries in the database. Dispatches entry-archived
// messages once the internal transaction completes. max_age is in ms, optional,
// defaults to two days, how old an entry must be in order to archive it.
ModelAccess.prototype.archiveEntries = function(max_age = TWO_DAYS_MS) {
  return new Promise((resolve, reject) => {
    const entry_ids = [];
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      for (const id of entry_ids) {
        // This occurs in a later tick so must trap exceptions. Because the
        // transaction committed by this point, just warn.
        try {
          this.channel.postMessage({type: 'entry-archived', id: id});
        } catch (error) {
          console.warn(error);
        }
      }
      resolve();
    };
    txn.onerror = event => {
      reject(event.target.error);
    };

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

      // Cannot throw because this occurs in a later tick where exception would
      // not be translated into rejection and would leave promise unsettled
      // TODO: abort the transaction? or reject and return?
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
  });
};

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

ModelAccess.prototype.close = function() {
  if (this.channel) {
    this.channel.close();
  }

  this.conn.close();
};

export async function openModelAccess(writable, name, version, timeout) {
  const ma = new ModelAccess();
  await ma.connect(writable, name, version, timeout);
  return ma;
}

ModelAccess.prototype.connect = async function(
    writable = false, name = 'reader', version = 24, timeout = 500) {
  // We only need a channel in write mode
  if (writable) {
    this.channel = new BroadcastChannel('reader');
  }

  this.conn = await indexeddb.open(name, version, on_upgrade_needed, timeout);
};

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

ModelAccess.prototype.createFeed = function(feed) {
  return new Promise((resolve, reject) => {
    assert(Model.is_feed(feed));
    assert(feed.urls && feed.urls.length);
    object.filter_empty_properties(feed);

    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;

    let id = 0;
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = event => {
      reject(event.target.error);
    };

    txn.oncomplete = _ => {
      try {
        this.channel.postMessage({type: 'feed-created', id: id});
      } catch (error) {
        console.warn(error);
      }

      resolve(id);
    };

    const store = txn.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = _ => id = request.result;
  });
};

ModelAccess.prototype.createFeeds = function(feeds) {
  return new Promise((resolve, reject) => {
    for (const feed of feeds) {
      assert(Model.is_feed(feed));
      assert(feed.urls && feed.urls.length);

      object.filter_empty_properties(feed);

      if (feed.active === undefined) {
        feed.active = true;
      }

      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    }

    const ids = [];
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = event => {
      reject(event.target.error);
    };

    txn.oncomplete = _ => {
      // try intentionally outside the for loop, want to stop iteration on first
      // error, because it means that the rest will probably also fail
      try {
        for (const id of ids) {
          this.channel.postMessage({type: 'feed-created', id: id});
        }
      } catch (error) {
        console.warn(error);
      }

      resolve(ids);
    };

    function request_onsuccess(event) {
      const id = event.target.result;
      ids.push(id);
    }

    const store = txn.objectStore('feed');
    for (const feed of feeds) {
      const request = store.put(feed);
      request.onsuccess = request_onsuccess;
    }
  });
};

ModelAccess.prototype.countUnreadEntries = function() {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Model.ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
};

ModelAccess.prototype.deactivateFeed = function(feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Model.is_valid_feed_id(feed_id));
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      try {
        this.channel.postMessage({type: 'feed-deactivated', id: feed_id});
      } catch (error) {
        console.warn(error);
      }

      resolve();
    };
    txn.onerror = event => {
      reject(event.target.error);
    };

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
  });
};

ModelAccess.prototype.deleteEntry = function(entry_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Model.is_valid_entry_id(entry_id));
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const msg = {type: 'entry-deleted', id: entry_id, reason: reason};
      try {
        this.channel.postMessage(msg);
      } catch (error) {
        console.warn(error);
      }

      resolve();
    };
    txn.onerror = event => {
      reject(event.target.error);
    };
    txn.objectStore('entry').delete(entry_id);
  });
};

ModelAccess.prototype.deleteFeed = function(feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Model.is_valid_feed_id(feed_id));

    const entry_ids = [];
    const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
    txn.onerror = event => {
      reject(event.target.error);
    };
    txn.oncomplete = _ => {
      // the whole thing is within try block because first failure probably
      // means rest of postMessage calls will fail and are pointless to try
      try {
        let msg = {type: 'feed-deleted', id: feed_id, reason: reason};
        this.channel.postMessage(msg);
        msg = {type: 'entry-deleted', id: 0, reason: reason, feed_id: feed_id};
        for (const id of entry_ids) {
          msg.id = id;
          this.channel.postMessage(msg);
        }
      } catch (error) {
        console.warn(error);
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
        entry_store.delete(id);
      }
    };
  });
};

ModelAccess.prototype.getEntries = function(mode = 'all', offset, limit) {
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
    txn.onerror = event => {
      reject(event.target.error);
    };
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
  });
};

ModelAccess.prototype.getEntry = function(mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || Model.is_valid_entry_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = this.conn.transaction('entry');
    txn.onerror = event => {
      reject(event.target.error);
    };
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
  });
};

ModelAccess.prototype.getFeedIds = function() {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('feed');
    txn.onerror = event => {
      reject(event.target.error);
    };
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
};

ModelAccess.prototype.getFeed = function(mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || Model.is_valid_feed_id(value));
    assert(mode !== 'id' || !key_only);

    const txn = this.conn.transaction('feed');
    txn.onerror = event => {
      reject(event.target.error);
    };
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
  });
};

ModelAccess.prototype.getFeeds = function(mode = 'all', sort = false) {
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

// TODO: drop mode parameter, it is no longer in use, not doing it right now
// because I am focusing on archiveEntries
ModelAccess.prototype.iterateEntries = function(
    mode = 'all', writable, handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');

    const txn_mode = writable ? 'readwrite' : 'readonly';
    const txn = this.conn.transaction('entry', txn_mode);
    txn.oncomplete = resolve;
    txn.onerror = event => {
      reject(event.target.error);
    };
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
  });
};

ModelAccess.prototype.markEntryRead = function(entry_id) {
  return new Promise((resolve, reject) => {
    assert(Model.is_valid_entry_id(entry_id));

    const txn = this.conn.transaction('entry', 'readwrite');
    txn.onerror = event => {
      reject(event.target.error);
    };
    txn.oncomplete = _ => {
      try {
        this.channel.postMessage({type: 'entry-read', id: entry_id});
      } catch (error) {
        console.warn(error);
      }

      resolve();
    };

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
  });
};


ModelAccess.prototype.createEntry = function(entry) {
  return new Promise((resolve, reject) => {
    assert(Model.is_entry(entry));
    assert(entry.id === undefined);

    if (entry.readState === undefined) {
      entry.readState = Model.ENTRY_STATE_UNREAD;
    }

    if (entry.archiveState === undefined) {
      entry.archiveState = Model.ENTRY_STATE_UNARCHIVED;
    }

    if (entry.dateCreated === undefined) {
      entry.dateCreated = new Date();
    }

    delete entry.dateUpdated;
    object.filter_empty_properties(entry);

    let id;
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const message = {type: 'entry-created', id: id};
      try {
        this.channel.postMessage(message);
      } catch (error) {
        console.warn(error);
      }

      resolve(id);
    };
    txn.onerror = event => {
      reject(event.target.error);
    };
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = _ => id = request.result;
  });
};

ModelAccess.prototype.updateEntry = function(entry) {
  return new Promise((resolve, reject) => {
    assert(Model.is_entry(entry));
    assert(Model.is_valid_entry_id(entry.id));

    entry.dateUpdated = new Date();
    object.filter_empty_properties(entry);

    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      try {
        this.channel.postMessage({type: 'entry-updated', id: entry.id});
      } catch (error) {
        console.warn(error);
      }

      resolve(entry.id);
    };
    txn.onerror = event => {
      reject(event.target.error);
    };
    const store = txn.objectStore('entry');
    const request = store.put(entry);
  });
};

ModelAccess.prototype.updateFeed = function(feed) {
  return new Promise((resolve, reject) => {
    assert(Model.is_feed(feed));
    assert(feed.urls && feed.urls.length);
    assert(Model.is_valid_feed_id(feed.id));

    object.filter_empty_properties(feed);
    feed.dateUpdated = new Date();

    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = event => {
      reject(event.target.error);
    };
    txn.oncomplete = _ => {
      const message = {type: 'feed-updated', id: feed.id};
      try {
        this.channel.postMessage(message);
      } catch (error) {
        console.warn(error);
      }

      resolve();
    };

    const store = txn.objectStore('feed');
    const request = store.put(feed);
  });
};
