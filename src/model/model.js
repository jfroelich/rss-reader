import {assert} from '/src/lib/assert.js';
import {Deadline, INDEFINITE} from '/src/lib/deadline.js';
import * as indexeddb_utils from '/src/lib/indexeddb-utils.js';
import * as object_utils from '/src/lib/object-utils.js';
import {sizeof} from '/src/lib/sizeof.js';
import * as magic from '/src/model/magic.js';
import {Entry, is_entry} from '/src/model/entry.js';
import {Feed, is_feed} from '/src/model/feed.js';

export function Model() {
  // Database connection properties
  this.conn = undefined;
  this.name = 'reader';
  this.version = 29;

  // This should point to a class that implements the unspecified Channel
  // interface. This should be set prior to calling open. The default channel
  // is a browser-specific cross-tab channel.
  this.channel_class = BroadcastChannel;
  this.channel = undefined;
  this.channel_name = 'reader';
}

// |timeout| is the optional maximum time in milliseconds of type Deadline
// before considering an attempt to open a connection to the database a failure.
Model.prototype.open = async function(timeout = INDEFINITE) {
  assert(this.channel_class);
  assert(timeout instanceof Deadline);

  assert(typeof this.channel_name === 'string');
  assert(typeof this.name === 'string');
  assert(typeof this.upgradeHandler === 'function');

  this.conn = await indexeddb_utils.open(
      this.name, this.version, this.upgradeHandler.bind(this), timeout);
  this.channel = new this.channel_class(this.channel_name);
};

Model.prototype.close = function() {
  this.channel.close();
  this.channel = undefined;
  this.conn.close();
  this.conn = undefined;
};

// event.oldVersion is 0 when the database is being created
// use conn.version to get the current version
Model.prototype.upgradeHandler = function(event) {
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
    this.addMagicToEntries(txn);
  }

  if (event.oldVersion > 0 && event.oldVersion < 22) {
    this.addMagicToFeeds(txn);
  }

  if (event.oldVersion > 0 && event.oldVersion < 23) {
    feed_store.deleteIndex('title');
  }

  if (event.oldVersion > 0 && event.oldVersion < 24) {
    this.addActiveFieldToFeeds(feed_store);
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
      this.ensureEntriesHaveDatePublished(entry_store);
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
};

Model.validateFeed = function(feed) {
  assert(is_feed(feed));
  const now = new Date();

  vassert(feed.id === undefined || Feed.isValidId(feed.id));
  vassert(
      feed.active === undefined || feed.active === true ||
      feed.active === false);
  vassert(feed.urls === undefined || Array.isArray(feed.urls));
  vassert(feed.title === undefined || typeof feed.title === 'string');
  vassert(
      feed.type === undefined || feed.type === 'rss' || feed.type === 'feed' ||
      feed.type === 'rdf');
  vassert(feed.link === undefined || typeof feed.link === 'string');
  vassert(
      feed.description === undefined || typeof feed.description === 'string');
  vassert(
      feed.deactivationReasonText === undefined ||
      typeof feed.deactivationReasonText === 'string');

  vassert(is_valid_date(feed.deactivateDate));
  vassert(is_date_lte(feed.deactivateDate, now));
  vassert(is_valid_date(feed.dateCreated));
  vassert(is_date_lte(feed.dateCreated, now));
  vassert(is_date_lte(feed.dateCreated, feed.deactivateDate));
  vassert(is_valid_date(feed.dateUpdated));
  vassert(is_date_lte(feed.dateUpdated, now));
  vassert(is_date_lte(feed.dateCreated, feed.dateUpdated));
  vassert(is_valid_date(feed.datePublished));
  vassert(is_date_lte(feed.datePublished, now));
  vassert(is_valid_date(feed.dateLastModifed));
  vassert(is_date_lte(feed.dateLastModifed, now));
  vassert(is_valid_date(feed.dateFetched));
  vassert(is_date_lte(feed.dateFetched, now));
};

Model.validateEntry = function(entry) {
  assert(is_entry(entry));
  const now = new Date();

  vassert(entry.id === undefined || Entry.isValidId(entry.id));
  vassert(entry.feed === undefined || Feed.isValidId(entry.feed));
  vassert(entry.urls === undefined || Array.isArray(entry.urls));
  vassert(
      entry.readState === undefined || entry.readState === Entry.READ ||
      entry.readState === Entry.UNREAD);
  vassert(
      entry.archiveState === undefined ||
      entry.archiveState === Entry.ARCHIVED ||
      entry.archiveState === Entry.UNARCHIVED);
  vassert(entry.author === undefined || typeof entry.author === 'string');
  vassert(entry.content === undefined || typeof entry.content === 'string');

  vassert(is_valid_date(entry.dateCreated));
  vassert(is_date_lte(entry.dateCreated, now));
  vassert(is_valid_date(entry.dateUpdated));
  vassert(is_date_lte(entry.dateUpdated, now));
  vassert(is_date_lte(entry.dateCreated, entry.dateUpdated));
  vassert(is_valid_date(entry.datePublished));
  vassert(is_date_lte(entry.datePublished, now));
  validate_enclosure(entry.enclosure);
};

Model.prototype.archiveEntries = function(max_age) {
  return new Promise((resolve, reject) => {
    if (typeof max_age === 'undefined') {
      const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
      max_age = TWO_DAYS_MS;
    }

    const entry_ids = [];
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      for (const id of entry_ids) {
        this.channel.postMessage({type: 'entry-archived', id: id});
      }
      resolve(entry_ids);
    };
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [Entry.UNARCHIVED, Entry.READ];
    const request = index.openCursor(key_path);
    request.onsuccess = event => {
      const cursor = event.target.result;
      if (!cursor) {
        return;
      }

      const entry = cursor.value;
      if (!is_entry(entry)) {
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
        const ae = this.archiveEntry(entry);
        cursor.update(ae);
        entry_ids.push(ae.id);
      }

      cursor.continue();
    };
  });
};

Model.prototype.countUnreadEntriesByFeed = function(id) {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('feed-readState');
    const range_only_value = [id, Entry.UNREAD];
    const request = index.count(range_only_value);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
};

Model.prototype.countUnreadEntries = function() {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
};

Model.prototype.createEntry = function(entry) {
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(entry.id === undefined);

    if (entry.readState === undefined) {
      entry.readState = Entry.UNREAD;
    }

    if (entry.archiveState === undefined) {
      entry.archiveState = Entry.UNARCHIVED;
    }

    if (entry.dateCreated === undefined) {
      entry.dateCreated = new Date();
    }

    // All entries need to appear in the datePublished index
    if (entry.datePublished === undefined) {
      entry.datePublished = entry.dateCreated;
    }

    delete entry.dateUpdated;
    object_utils.filter_empty_properties(entry);

    let id;
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      this.channel.postMessage({type: 'entry-created', id: id});
      resolve(id);
    };
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = _ => id = request.result;
  });
};

Model.prototype.createFeed = function(feed) {
  return new Promise((resolve, reject) => {
    assert(is_feed(feed));

    // A feed requires a url
    assert(Feed.prototype.hasURL.call(feed));

    // If feed.active is true, then leave as true. If false, leave as false.
    // But if undefined, impute true. This allows the caller to create
    // inactive feeds
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;
    object_utils.filter_empty_properties(feed);

    let id = 0;
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      this.channel.postMessage({type: 'feed-created', id: id});
      resolve(id);
    };

    const store = txn.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = _ => id = request.result;
  });
};

Model.prototype.createFeeds = function(feeds) {
  return new Promise((resolve, reject) => {
    assert(feeds);
    for (const feed of feeds) {
      assert(is_feed(feed));
      assert(Feed.prototype.hasURL.call(feed));
    }

    for (const feed of feeds) {
      object_utils.filter_empty_properties(feed);
      // Allow explicit false
      if (feed.active === undefined) {
        feed.active = true;
      }
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    }

    const ids = [];
    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      for (const id of ids) {
        this.channel.postMessage({type: 'feed-created', id: id});
      }
      resolve(ids);
    };

    function request_onsuccess(event) {
      ids.push(event.target.result);
    }

    const store = txn.objectStore('feed');
    for (const feed of feeds) {
      const request = store.put(feed);
      request.onsuccess = request_onsuccess;
    }
  });
};

Model.prototype.deleteEntry = function(id) {
  return new Promise((resolve, reject) => {
    assert(Entry.isValidId(id));
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      this.channel.postMessage({type: 'entry-deleted', id: id});
      resolve();
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').delete(id);
  });
};

Model.prototype.deleteFeed = function(feed_id, reason) {
  return new Promise((resolve, reject) => {
    assert(Feed.isValidId(feed_id));
    const entry_ids = [];

    const txn = this.conn.transaction(['feed', 'entry'], 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = _ => {
      this.channel.postMessage(
          {type: 'feed-deleted', id: feed_id, reason: reason});
      for (const id of entry_ids) {
        this.channel.postMessage(
            {type: 'entry-deleted', id: id, reason: reason, feed_id: feed_id});
      }
      resolve(entry_ids);
    };

    const feed_store = txn.objectStore('feed');
    feed_store.delete(feed_id);

    const entry_store = txn.objectStore('entry');
    const feed_index = entry_store.index('feed');
    // Avoid loading full entry data
    const request = feed_index.getAllKeys(feed_id);
    request.onsucess = function(event) {
      const keys = event.target.result;
      for (const id of keys) {
        entry_ids.push(id);
        entry_store.delete(id);
      }
    };
  });
};

Model.prototype.getEntry = function(mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || Entry.isValidId(value));
    assert(mode !== 'id' || !key_only);

    const txn = this.conn.transaction('entry');
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
      reject(new TypeError('Invalid mode ' + mode));
      return;
    }

    request.onsuccess = _ => {
      let entry;
      if (key_only) {
        const entry_id = request.result;
        if (Entry.isValidId(entry_id)) {
          entry = new Entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
};

Model.prototype.getEntries = function(mode = 'all', offset, limit) {
  return new Promise((resolve, reject) => {
    assert(is_valid_offset(offset));
    assert(is_valid_limit(limit));
    const entries = [];
    let advanced = false;

    const txn = this.conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archiveState-readState');
      const path = [Entry.UNARCHIVED, Entry.UNREAD];
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
  });
};

Model.prototype.getFeedIds = function() {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('feed');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
};

Model.prototype.getFeed = function(mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || value instanceof URL);
    assert(mode !== 'id' || Feed.isValidId(value));
    assert(mode !== 'id' || !key_only);
    const txn = this.conn.transaction('feed');
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
      reject(new TypeError('Invalid mode ' + mode));
      return;
    }

    request.onsuccess = event => {
      let feed;
      if (key_only) {
        const feed_id = request.result;
        if (Feed.isValidId(feed_id)) {
          feed = new Feed();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
};

Model.prototype.getFeeds = function(mode = 'all', title_sort) {
  return new Promise((resolve, reject) => {
    const txn = this.conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();
    request.onerror = _ => reject(request.error);
    request.onsuccess = _ => {
      let feeds = request.result;

      if (mode === 'active') {
        feeds = feeds.filter(feed => feed.active);
      }

      if (title_sort) {
        feeds.sort(function(a, b) {
          const s1 = a.title ? a.title.toLowerCase() : '';
          const s2 = b.title ? b.title.toLowerCase() : '';
          return indexedDB.cmp(s1, s2);
        });
      }

      resolve(feeds);
    };
  });
};

Model.prototype.iterateEntries = function(handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');
    const txn = this.conn.transaction('entry', 'readwrite');
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
  });
};

Model.prototype.queryEntries = function(query = {}) {
  return new Promise((resolve, reject) => {
    assert(typeof query === 'object');
    assert(query.feed_id === undefined || Feed.isValidId(query.feed_id));
    assert(is_valid_read_state(query.read_state));
    assert(is_valid_offset(query.offset));
    assert(is_valid_direction(query.direction));

    const offset = query.offset === undefined ? 0 : query.offset;
    const limit = query.limit === undefined ? 0 : query.limit;
    const direction = this.translateDirection(query.direction);
    const entries = [];

    const txn = this.conn.transaction('entry');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const request = this.queryEntriesBuildRequest(store, query, direction);

    // Setup a shared state across all cursor event handlers
    const cursor_state = {};
    cursor_state.advanced = offset ? false : true;
    cursor_state.offset = offset;
    cursor_state.limit = limit;
    cursor_state.entries = entries;
    cursor_state.callback = resolve;

    request.onsuccess = function(event) {
      const cursor = event.target.result;

      // This is one of two iteration stopping conditions. If there is no
      // cursor, we are done. We might not have encountered any entries at
      // all, or we advanced the cursor past the end.
      if (!cursor) {
        cursor_state.callback(cursor_state.entries);
        return;
      }

      // If we have not advanced and an offset was specified, then ignore the
      // current cursor value, and jump ahead to the offset.
      if (!cursor_state.advanced && cursor_state.offset > 0) {
        cursor_state.advanced = true;
        cursor.advance(cursor_state.offset);
        return;
      }

      cursor_state.entries.push(cursor.value);

      // If we are limited and reached the limit, then do not continue. This
      // is also a stopping condition. Technically the condition should just
      // be === limit, and using >= is a relaxed condition out of paranoia
      // related to concurrency.
      if (cursor_state.limit > 0 &&
          cursor_state.entries.length >= cursor_state.limit) {
        cursor_state.callback(cursor_state.entries);
        return;
      }

      cursor.continue();
    };
  });
};

// Modify the read state property of an entry in the database. |id| is id of
// entry in database to modify. |read| is boolean, true if marking as read,
// false if marking as unread, defaults to false.
Model.prototype.setEntryReadState = function(id, read = false) {
  return new Promise((resolve, reject) => {
    assert(Entry.isValidId(id));
    assert(typeof read === 'boolean');
    const txn = this.conn.transaction('entry', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      this.channel.postMessage({type: 'entry-updated', id: id, read: read});
      resolve();
    };
    const store = txn.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = function(event) {
      const entry = event.target.result;

      if (!entry) {
        const message = 'No entry found with id ' + id;
        const error = new NotFoundError(message);
        reject(error);
        return;
      }

      if (!is_entry(entry)) {
        const message = 'Matched object is not an entry ' + id;
        const error = new TypeError(message);
        reject(error);
        return;
      }

      if (entry.archiveState === Entry.ARCHIVED) {
        const message = 'Cannot change read state of archived entry ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      if (read && entry.readState === Entry.READ) {
        const message = 'Cannot mark read entry as read ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      } else if (!read && entry.readState === Entry.UNREAD) {
        const message = 'Cannot mark unread entry as unread ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      entry.readState = read ? Entry.READ : Entry.UNREAD;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      if (read) {
        entry.dateRead = currentDate;
      } else {
        delete entry.dateRead;
      }

      event.target.source.put(entry);
    };
  });
};

Model.prototype.updateEntry = function(entry) {
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(Entry.isValidId(entry.id));
    // Entries are not required to have urls in the model layer.

    entry.dateUpdated = new Date();
    object_utils.filter_empty_properties(entry);

    const txn = this.conn.transaction('entry', 'readwrite');
    txn.oncomplete = event => {
      this.channel.postMessage({
        type: 'entry-updated',
        id: entry.id,
        // NOTE! This does not indicate transition, just current state
        read: entry.readState === Entry.READ ? true : false
      });
      resolve(entry);
    };
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').put(entry);
  });
};

Model.prototype.updateFeed = function(feed, overwrite) {
  return new Promise((resolve, reject) => {
    // If overwriting, the new feed must be valid. If partial update, the new
    // feed is just a bag of properties, but it at least must be an object.
    if (overwrite) {
      assert(is_feed(feed));
    } else {
      assert(typeof feed === 'object');
    }

    // In both overwriting and partial situation, feed.id must be valid
    assert(Feed.isValidId(feed.id));

    // If overwriting, the feed must have a url. If partial, feed is just a
    // bag of properties.
    if (overwrite) {
      assert(Feed.prototype.hasURL.call(feed));
    }

    // If overwriting, remove unused properties. If partial, feed is just a
    // bag of properties and undefined keys signify properties that should be
    // removed from the old feed.
    if (overwrite) {
      object_utils.filter_empty_properties(feed);
    }

    // If overwriting, set the dateUpdated property. If partial, it will be
    // set later by the partial logic.
    if (overwrite) {
      feed.dateUpdated = new Date();
    }

    const txn = this.conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = event => {
      // TODO: do not pass the entire giant feed object through the channel.
      // Expose only those properties needed by event consumers. Also, pass
      // those properties as properties of the event itself, not a nested feed
      // object, because callers should only expect a basic event, not a full
      // fledged feed object. Also, review why it is even needed. If the only
      // things needed are things like the cleaned feed title, then maybe just
      // expose title.
      this.channel.postMessage({
        type: 'feed-updated',
        id: feed.id,
        feed: overwrite ? undefined : feed
      });
      resolve();
    };
    const store = txn.objectStore('feed');

    // The overwrite case is simple
    if (overwrite) {
      store.put(feed);
      return;
    }

    // In the partial update case, we load the old feed, adjust some of its
    // properties, and then overwrite it
    const request = store.get(feed.id);
    request.onsuccess = function(event) {
      const old_feed = event.target.result;
      if (!old_feed) {
        const message = 'Failed to find feed to update for id ' + feed.id;
        const error = new NotFoundError(message);
        reject(error);
        return;
      }

      if (!is_feed(old_feed)) {
        const message = 'Matched object is not of type feed for id ' + feed.id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      // Before overwriting individual properties, validate certain property
      // value transitions. Assume each property is a known feed property with
      // a valid value.

      // If you want to activate a feed, it must not already be active. If you
      // want to update the feed regardless, you should not have specified the
      // active property in the partial update use case.
      if (feed.active === true && old_feed.active === true) {
        const message =
            'Cannot activate already active feed with id ' + feed.id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      // Similarly, should not try to deactivate an inactive feed.
      if (feed.active === false && old_feed.active === false) {
        const message = 'Cannot deactivate inactive feed with id ' + feed.id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      // Setup auto-transitions
      // When activating a feed, two other properties related to deactivation
      // should be specified as undefined to indicate intent to remove.
      if (feed.active === true) {
        if (!('deactivationReasonText' in feed)) {
          feed.deactivationReasonText = undefined;
        }

        if (!('deactivateDate' in feed)) {
          feed.deactivateDate = undefined;
        }
      }

      // When deactivating, record the date
      if (feed.active === false) {
        if (!('deactivateDate' in feed)) {
          feed.deactivateDate = new Date();
        }
      }

      // Overwrite the old property values with the new property values for
      // those properties explicitly specified in props. If a property is
      // present but undefined, that means the caller's intent was to remove
      // the property.
      for (const key in feed) {
        // Treat id as immutable.
        if (key === 'id') {
          continue;
        }

        const value = feed[key];
        if (value === undefined) {
          delete old_feed[key];
        } else {
          old_feed[key] = value;
        }
      }

      old_feed.dateUpdated = new Date();
      event.target.source.put(old_feed);
    };
  });
};

// TODO: operate on the transaction, not the store
Model.prototype.ensureEntriesHaveDatePublished = function(store) {
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
};

Model.prototype.addMagicToEntries = function(txn) {
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function() {
    const cursor = request.result;
    if (cursor) {
      const entry = cursor.value;
      if (!('magic' in entry)) {
        entry.magic = magic.ENTRY_MAGIC;
        entry.dateUpdated = new Date();
        cursor.update(entry);
      }
      cursor.continue();
    }
  };
};

Model.prototype.addMagicToFeeds = function(txn) {
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = magic.FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
};

// TODO: operate on the transaction, not the store
Model.prototype.addActiveFieldToFeeds = function(store) {
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
};

Model.prototype.archiveEntry = function(entry) {
  const before_size = sizeof(entry);
  const ce = new Entry();
  ce.dateCreated = entry.dateCreated;
  ce.datePublished = entry.datePublished;
  if (!ce.datePublished) {
    ce.datePublished = ce.dateCreated;
  }

  if (entry.dateRead) {
    ce.dateRead = entry.dateRead;
  }

  ce.feed = entry.feed;
  ce.id = entry.id;
  ce.readState = entry.readState;
  ce.urls = entry.urls;

  // We do not measure all fields retained
  const after_size = sizeof(ce);
  if (after_size > before_size) {
    console.warn(
        'Archiving entry increased size by %d', after_size - before_size, entry,
        ce);
  }

  ce.archiveState = Entry.ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
};

// Translate the query parameter direction into the indexedDB cursor direction
Model.prototype.translateDirection = function(direction) {
  // Assume that by this point the input direction is valid so there is no
  // need for a sanity check. The absence of a precondition assertion also
  // seems reasonable because this is an internal function and not part of the
  // public API, so it is free to enjoy caller guarantees.

  // There is no need to translate in the default case of iterating forward.
  // So we leave the output direction as undefined in that case, which will
  // have the effect of specifying undefined to openCursor later, which will
  // then default to forward (next). So we only need to have an explicit value
  // in the reverse case.
  return direction === 'DESC' ? 'prev' : undefined;
};

// Compose an IDBRequest object based on query values
Model.prototype.queryEntriesBuildRequest = function(store, query, direction) {
  let request;
  // Several branches use these same two variables
  const min_date = new Date(1);
  const max_date = new Date();
  // Shorter alias
  const read = Entry.READ;
  const unread = Entry.UNREAD;

  if (query.feed_id === 0 || query.feed_id === undefined) {
    if (query.read_state === undefined) {
      const index = store.index('datePublished');
      let range = undefined;
      request = index.openCursor(range, direction);
    } else if (query.read_state === unread) {
      const index = store.index('readState-datePublished');
      const lower_bound = [unread, min_date];
      const upper_bound = [unread, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    } else {
      const index = store.index('readState-datePublished');
      const lower_bound = [read, min_date];
      const upper_bound = [read, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    }
  } else {
    if (query.read_state === undefined) {
      const index = store.index('feed-datePublished');
      const lower_bound = [query.feed_id, min_date];
      const upper_bound = [query.feed_id, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    } else if (query.read_state === unread) {
      const index = store.index('feed-readState-datePublished');
      const lower_bound = [query.feed_id, unread, min_date];
      const upper_bound = [query.feed_id, unread, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    } else {
      const index = store.index('feed-readState-datePublished');
      const lower_bound = [query.feed_id, read, min_date];
      const upper_bound = [query.feed_id, read, max_date];
      const range = IDBKeyRange.bound(lower_bound, upper_bound);
      request = index.openCursor(range, direction);
    }
  }

  return request;
};

function is_valid_direction(dir) {
  return dir === undefined || dir === 'ASC' || dir === 'DESC';
}

function is_valid_date(value) {
  return value === undefined || !isNaN(value.getTime());
}

function is_date_lte(date1, date2) {
  return date1 === undefined || date2 === undefined || date1 <= date2;
}

// Validate the enclosure property of a feed
function validate_enclosure(enc) {
  if (enc === undefined || enc === null) {
    return;
  }

  vassert(typeof enc === 'object');
  vassert(
      enc.url === undefined || enc.url === null || typeof enc.url === 'string');
  vassert(
      enc.enclosureLength === undefined || enc.enclosureLength === null ||
      typeof enc.enclosureLength === 'string');
  vassert(
      enc.type === undefined || enc.type === null ||
      typeof enc.type === 'string');
}

// An assertion-like utility for throwing validation errors
function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

function is_valid_read_state(state) {
  return state === undefined || state === Entry.READ || state === Entry.UNREAD;
}

function is_valid_offset(offset) {
  return offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0);
}

function is_valid_limit(limit) {
  return limit === null || limit === undefined || limit === NaN ||
      (Number.isInteger(limit) && limit >= 0);
}

// This error should occur when either an operation against the database is in
// the wrong state, or the data involved in the operation is in the wrong state.
export class InvalidStateError extends Error {
  constructor(message = 'InvalidStateError') {
    super(message);
  }
}

// This error should occur when something that was expected to exist in the
// database was not found.
export class NotFoundError extends Error {
  constructor(message = 'The data expected to be found was not found') {
    super(message);
  }
}

export class ValidationError extends Error {
  constructor(message = 'Validation error') {
    super(message);
  }
}
