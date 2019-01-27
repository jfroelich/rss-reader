import {assert} from '/src/assert.js';
import * as idb from '/src/idb.js';
import * as utils from '/src/utils.js';

const DEFAULT_NAME = 'reader';
const DEFAULT_VERSION = 29;
const DEFAULT_TIMEOUT = 500;

export const ENTRY_MAGIC = 0xdeadbeef;
export const FEED_MAGIC = 0xfeedfeed;

// Various entry property states
export const ENTRY_UNREAD = 0;
export const ENTRY_READ = 1;
export const ENTRY_UNARCHIVED = 0;
export const ENTRY_ARCHIVED = 1;

// A sentinel value for entry ids. This shares the same type as a real entry
// id, but is outside the range, because indexedDB's auto-increment algorithm
// starts with 1.
export const INVALID_ENTRY_ID = 0;
export const INVALID_FEED_ID = 0;

const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;

export function append_entry_url(entry, url) {
  assert(is_entry(entry));
  return append_url_common(entry, url);
}

export function is_entry(value) {
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function construct_entry() {
  return {magic: ENTRY_MAGIC};
}

export function is_valid_entry_id(value) {
  return Number.isInteger(value) && value > 0;
}

export function entry_has_url(entry) {
  assert(is_entry(entry));
  return Array.isArray(entry.urls) && entry.urls.length;
}

export function construct_feed() {
  return {magic: FEED_MAGIC};
}

export function is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function feed_has_url(feed) {
  assert(is_feed(feed));
  return Array.isArray(feed.urls) && feed.urls.length;
}

export function append_feed_url(feed, url) {
  assert(is_feed(feed));
  return append_url_common(feed, url);
}

// Returns a promise that resolves to a new database connection or rejects with
// an error.
export function open(name, version, timeout) {
  if (name === undefined) {
    name = DEFAULT_NAME;
  }

  if (version === undefined) {
    version = DEFAULT_VERSION;
  }

  if (timeout === undefined) {
    timeout = DEFAULT_TIMEOUT;
  }

  return idb.open(name, version, on_upgrade_needed, timeout);
}

// event.oldVersion is 0 when the database is being created
// use conn.version to get the current version
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

  if (event.oldVersion > 0 && event.oldVersion < 21) {
    add_magic_to_entries(txn);
  }

  if (event.oldVersion > 0 && event.oldVersion < 22) {
    add_magic_to_feeds(txn);
  }

  if (event.oldVersion > 0 && event.oldVersion < 23) {
    feed_store.deleteIndex('title');
  }

  if (event.oldVersion > 0 && event.oldVersion < 24) {
    add_active_field_to_feeds(feed_store);
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
    // If there may be existing entries, then ensure that all older entries have
    // a datePublished
    if (event.oldVersion) {
      ensure_entries_have_date_published(entry_store);
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

function ensure_entries_have_date_published(store) {
  const request = store.openCursor();
  request.onerror = _ => console.error(request.error);

  request.onsuccess = event => {
    const cursor = request.result;
    if (!cursor) {
      return;
    }
    const entry = cursor.value;
    if (!entry.datePublished) {
      entry.datePublished = entry.dateCreated;
      entry.dateUpdated = new Date();
      cursor.update(entry);
    }
    cursor.continue();
  };
}

function add_magic_to_entries(txn) {
  const store = txn.objectStore('entry');
  const request = store.openCursor();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function() {
    const cursor = request.result;
    if (!cursor) {
      return;
    }

    const entry = cursor.value;
    if (!('magic' in entry)) {
      entry.magic = ENTRY_MAGIC;
      entry.dateUpdated = new Date();
      cursor.update(entry);
    }
    cursor.continue();
  };
}

function add_magic_to_feeds(txn) {
  const store = txn.objectStore('feed');
  const request = store.getAll();
  request.onerror = _ => console.error(request.error);
  request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = FEED_MAGIC;
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

export function archive_entries(conn, max_age = TWO_DAYS_MS) {
  return new Promise((resolve, reject) => {
    const entry_ids = [];
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => resolve(entry_ids);
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_UNARCHIVED, ENTRY_READ];
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
        const ae = archive_entry(entry);
        cursor.update(ae);
        entry_ids.push(ae.id);
      }

      cursor.continue();
    };
  });
}

function archive_entry(entry) {
  const before_size = utils.sizeof(entry);
  const ce = compact_entry(entry);
  const after_size = utils.sizeof(ce);

  if (after_size > before_size) {
    console.warn('Entry increased size', entry);
  }

  ce.archiveState = ENTRY_ARCHIVED;
  const current_date = new Date();
  ce.dateArchived = current_date;
  ce.dateUpdated = current_date;
  return ce;
}

function compact_entry(entry) {
  const ce = construct_entry();
  ce.dateCreated = entry.dateCreated;

  // Retain this past archival date so that it can still be displayed
  // in front end queries on datePublished index as of version 26 of database.
  ce.datePublished = entry.datePublished;

  // Prior to datePublished index being added in database version 26, entries
  // could be created without a publish date. Now entries must have one. This is
  // a migration fix.
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
  return ce;
}

export function count_unread_entries_by_feed(conn, id) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('feed-readState');
    const range_only_value = [id, ENTRY_UNREAD];
    const request = index.count(range_only_value);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

export function count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

export function create_entry(conn, entry) {
  // This intentionally does not resolve until the transaction resolves
  // because resolving when the request completes would be premature.
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(entry.id === undefined);

    if (entry.readState === undefined) {
      entry.readState = ENTRY_UNREAD;
    }

    if (entry.archiveState === undefined) {
      entry.archiveState = ENTRY_UNARCHIVED;
    }

    if (entry.dateCreated === undefined) {
      entry.dateCreated = new Date();
    }

    // All entries need to appear in the datePublished index
    if (entry.datePublished === undefined) {
      entry.datePublished = entry.dateCreated;
    }

    delete entry.dateUpdated;
    utils.filter_empty_properties(entry);
    let id;
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => resolve(id);
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = _ => id = request.result;
  });
}

export async function create_feed(conn, feed) {
  // This intentionally does not settle until the transaction completes
  return new Promise((resolve, reject) => {
    assert(is_feed(feed));
    assert(Array.isArray(feed.urls));
    assert(feed.urls.length);
    assert(typeof feed.urls[0] === 'string');
    assert(feed.urls[0].length);
    // If feed.active is true, then leave as true. If false, leave as false. But
    // if undefined, impute true. This allows the caller to create inactive
    // feeds
    if (feed.active === undefined) {
      feed.active = true;
    }

    feed.dateCreated = new Date();
    delete feed.dateUpdated;
    utils.filter_empty_properties(feed);
    let id = 0;
    const txn = conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = _ => resolve(id);
    const store = txn.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = _ => id = request.result;
  });
}

export function create_feeds(conn, feeds) {
  return new Promise((resolve, reject) => {
    assert(feeds);
    for (const feed of feeds) {
      assert(is_feed(feed));
      assert(feed.urls && feed.urls.length);
    }

    for (const feed of feeds) {
      utils.filter_empty_properties(feed);
      // Allow explicit false
      if (feed.active === undefined) {
        feed.active = true;
      }
      feed.dateCreated = new Date();
      delete feed.dateUpdated;
    }

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
  });
}

export function delete_entry(conn, id) {
  return new Promise((resolve, reject) => {
    assert(is_valid_entry_id(id));
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').delete(id);
  });
}

export function delete_feed(conn, feed_id) {
  return new Promise((resolve, reject) => {
    assert(is_valid_feed_id(feed_id));
    const entry_ids = [];
    const txn = conn.transaction(['feed', 'entry'], 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = _ => resolve(entry_ids);
    const feed_store = txn.objectStore('feed');
    feed_store.delete(feed_id);
    const entry_store = txn.objectStore('entry');
    const feed_index = entry_store.index('feed');
    // We use getAllKeys to avoid loading full entry data
    const request = feed_index.getAllKeys(feed_id);
    request.onsucess = function(event) {
      const keys = event.target.result;
      for (const id of keys) {
        entry_ids.push(id);
        entry_store.delete(id);
      }
    };
  });
}

export function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || is_valid_entry_id(value));
    assert(mode !== 'id' || !key_only);
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
      reject(new TypeError('Invalid mode ' + mode));
      return;
    }

    request.onsuccess = _ => {
      let entry;
      if (key_only) {
        const entry_id = request.result;
        if (is_valid_entry_id(entry_id)) {
          entry = construct_entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}

export function get_entries(conn, mode = 'all', offset, limit) {
  return new Promise((resolve, reject) => {
    assert(is_valid_offset(offset));
    assert(is_valid_limit(limit));
    const entries = [];
    let advanced = false;

    const txn = conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');

    let request;
    if (mode === 'viewable') {
      const index = store.index('archiveState-readState');
      const path = [ENTRY_UNARCHIVED, ENTRY_UNREAD];
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
}

export function get_feed_ids(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = _ => resolve(request.result);
  });
}

export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || is_valid_feed_id(value));
    assert(mode !== 'id' || !key_only);
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
      reject(new TypeError('Invalid mode ' + mode));
      return;
    }

    request.onsuccess = _ => {
      let feed;
      if (key_only) {
        const feed_id = request.result;
        if (is_valid_feed_id(feed_id)) {
          feed = construct_feed();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
    };
  });
}

export function get_feeds(conn, mode = 'all', title_sort) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
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
}

export function iterate_entries(conn, handle_entry) {
  return new Promise((resolve, reject) => {
    assert(typeof handle_entry === 'function');
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
  });
}

export async function mark_entry_read(conn, id) {
  return new Promise((resolve, reject) => {
    assert(is_valid_entry_id(id));
    const txn = conn.transaction('entry', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = resolve;
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
        const message = 'Read object is not an entry ' + id;
        const error = new TypeError(message);
        reject(error);
        return;
      }

      if (entry.archiveState === ENTRY_ARCHIVED) {
        const message = 'Cannot mark archived entry as read ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      if (entry.readState === ENTRY_READ) {
        const message = 'Cannot mark read entry as read ' + id;
        const error = new InvalidStateError(message);
        reject(error);
        return;
      }

      entry.readState = ENTRY_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;

      const entry_store = event.target.source;
      entry_store.put(entry);
    };
  });
}

export function query_entries(conn, query = {}) {
  return new Promise((resolve, reject) => {
    assert(typeof query === 'object');
    assert(query.feed_id === undefined || is_valid_feed_id(query.feed_id));
    assert(is_valid_read_state(query.read_state));
    assert(is_valid_offset(query.offset));
    assert(is_valid_direction(query.direction));

    const offset = query.offset === undefined ? 0 : query.offset;
    const limit = query.limit === undefined ? 0 : query.limit;
    const direction = translate_direction(query.direction);
    const entries = [];

    const txn = conn.transaction('entry');
    txn.onerror = event => reject(event.target.error);
    const store = txn.objectStore('entry');
    const request = query_entries_build_request(store, query, direction);

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
      // cursor, we are done. We might not have encountered any entries at all,
      // or we advanced the cursor past the end.
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

      // If we are limited and reached the limit, then do not continue. This is
      // also a stopping condition. Technically the condition should just be ===
      // limit, and using >= is a relaxed condition out of paranoia related to
      // concurrency.
      if (cursor_state.limit > 0 &&
          cursor_state.entries.length >= cursor_state.limit) {
        cursor_state.callback(cursor_state.entries);
        return;
      }

      cursor.continue();
    };
  });
}

// Translate the query parameter direction into the indexedDB cursor direction
function translate_direction(direction) {
  // Assume that by this point the input direction is valid so there is no
  // need for a sanity check. The absence of a precondition assertion also seems
  // reasonable because this is an internal function and not part of the public
  // API, so it is free to enjoy caller guarantees.

  // There is no need to translate in the default case of iterating forward. So
  // we leave the output direction as undefined in that case, which will have
  // the effect of specifying undefined to openCursor later, which will then
  // default to forward (next). So we only need to have an explicit value in the
  // reverse case.
  return direction === 'DESC' ? 'prev' : undefined;
}

// Compose an IDBRequest object based on query values
function query_entries_build_request(store, query, direction) {
  let request;
  // Several branches use these same two variables
  const min_date = new Date(1);
  const max_date = new Date();
  // Shorter alias
  const read = ENTRY_READ;
  const unread = ENTRY_UNREAD;

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
}

function is_valid_direction(dir) {
  return dir === undefined || dir === 'ASC' || dir === 'DESC';
}

export function update_entry(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(is_entry(entry));
    assert(is_valid_entry_id(entry.id));
    // Do not assert that the entry has a url. Entries are not required to
    // have urls in the db layer. Only higher layers are concerned with
    // imposing that constraint.
    entry.dateUpdated = new Date();
    utils.filter_empty_properties(entry);
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = resolve;
    txn.onerror = event => reject(event.target.error);
    txn.objectStore('entry').put(entry);
  });
}

export function update_feed(conn, feed, overwrite) {
  return new Promise((resolve, reject) => {
    // If overwriting, the new feed must be valid. If partial update, the new
    // feed is just a bag of properties, but it at least must be an object.
    if (overwrite) {
      assert(is_feed(feed));
    } else {
      assert(typeof feed === 'object');
    }

    // In both overwriting and partial situation, feed.id must be valid
    assert(is_valid_feed_id(feed.id));

    // If overwriting, the feed must have a url. If partial, feed is just a bag
    // of properties.
    if (overwrite) {
      assert(feed_has_url(feed));
    }

    // If overwriting, remove unused properties. If partial, feed is just a bag
    // of properties and undefined keys signify properties that should be
    // removed from the old feed.
    if (overwrite) {
      utils.filter_empty_properties(feed);
    }

    // If overwriting, set the dateUpdated property. If partial, it will be set
    // later by the partial logic.
    if (overwrite) {
      feed.dateUpdated = new Date();
    }

    const txn = conn.transaction('feed', 'readwrite');
    txn.onerror = event => reject(event.target.error);
    txn.oncomplete = resolve;
    const store = txn.objectStore('feed');

    // In the overwrite case, it is simple and we are done
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
      // value transitions. Assume each property is a known feed property with a
      // valid value.

      // If you want to activate a feed, it must not already be active. If you
      // want to update the feed regardless, you should not have specified the
      // active property in the partial use case.
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
      // present but undefined, that means the caller's intent was to remove the
      // property.
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
}

export function validate_entry(entry) {
  assert(is_entry(entry));
  const now = new Date();

  vassert(entry.id === undefined || is_valid_entry_id(entry.id));
  vassert(entry.feed === undefined || is_valid_feed_id(entry.feed));
  vassert(entry.urls === undefined || Array.isArray(entry.urls));
  vassert(
      entry.readState === undefined || entry.readState === ENTRY_READ ||
      entry.readState === ENTRY_UNREAD);
  vassert(
      entry.archiveState === undefined ||
      entry.archiveState === ENTRY_ARCHIVED ||
      entry.archiveState === ENTRY_UNARCHIVED);
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
}

function is_valid_date(value) {
  return value === undefined || !isNaN(value.getTime());
}

function is_date_lte(date1, date2) {
  return date1 === undefined || date2 === undefined || date1 <= date2;
}

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

export function validate_feed(feed) {
  assert(is_feed(feed));
  const now = new Date();

  vassert(feed.id === undefined || is_valid_feed_id(feed.id));
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
}

export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  assert(is_entry(entry));

  if (entry.author) {
    let author = entry.author;
    author = utils.filter_controls(author);
    author = utils.replace_tags(author, '');
    author = utils.condense_whitespace(author);
    author = utils.truncate_html(author, author_max_length);
    entry.author = author;
  }

  if (entry.content) {
    let content = entry.content;
    // We cannot use filter_controls because that matches \r\n. This was
    // previously the source of a bug
    content = utils.filter_unprintables(content);
    content = utils.truncate_html(content, content_max_length);
    entry.content = content;
  }

  if (entry.title) {
    let title = entry.title;
    title = utils.filter_controls(title);
    title = utils.replace_tags(title, '');
    title = utils.condense_whitespace(title);
    title = utils.truncate_html(title, title_max_length);
    entry.title = title;
  }
}

export function sanitize_feed(feed, title_max_len, desc_max_len) {
  assert(is_feed(feed));

  if (isNaN(title_max_len)) {
    title_max_len = 1024;
  }

  if (isNaN(desc_max_len)) {
    desc_max_len = 10240;
  }

  const html_tag_replacement = '';
  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = utils.filter_controls(title);
    title = utils.replace_tags(title, html_tag_replacement);
    title = utils.condense_whitespace(title);
    title = utils.truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = utils.filter_controls(desc);
    desc = utils.replace_tags(desc, html_tag_replacement);
    desc = utils.condense_whitespace(desc);
    desc = utils.truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}

// A utility function for throwing a custom type of error, in the style of an
// assert call.
function vassert(condition, message) {
  if (!condition) {
    throw new ValidationError(message);
  }
}

function is_valid_read_state(state) {
  return state === undefined || state === ENTRY_READ || state === ENTRY_UNREAD
}

function is_valid_offset(offset) {
  return offset === null || offset === undefined || offset === NaN ||
      (Number.isInteger(offset) && offset >= 0);
}

function is_valid_limit(limit) {
  return limit === null || limit === undefined || limit === NaN ||
      (Number.isInteger(limit) && limit >= 0);
}

function append_url_common(object, url) {
  assert(typeof url.href === 'string');

  const normal_url_string = url.href;
  if (object.urls) {
    if (object.urls.includes(normal_url_string)) {
      return false;
    }

    object.urls.push(normal_url_string);
  } else {
    object.urls = [normal_url_string];
  }

  return true;
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
