import {ENTRY_MAGIC, ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD} from '/src/app/objects/entry.js';
import {FEED_MAGIC} from '/src/app/objects/feed.js';
import {idb_open} from '/src/idb/idb.js';
import * as string from '/src/string/string.js';


// Open a connection to the reader database. All parameters are optional
export function open(name = 'reader', version = 24, timeout = 500) {
  return idb_open(name, version, on_upgrade_needed, timeout);
}

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version
// number.
function on_upgrade_needed(event) {
  const conn = event.target.result;
  const txn = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  console.log(
      'Upgrading database %s to version %s from version', conn.name,
      conn.version, event.oldVersion);

  if (event.oldVersion < 20) {
    feed_store =
        conn.createObjectStore('feed', {key_path: 'id', autoIncrement: true});
    entry_store =
        conn.createObjectStore('entry', {key_path: 'id', autoIncrement: true});
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

// Walk over the entry store one entry at a time and set the magic property for
// each entry. This returns prior to the operation completing.
// @param txn {IDBTransaction}
// @return {void}
function add_magic_to_entries(txn) {
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
function add_magic_to_feeds(txn) {
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
function add_active_field_to_feeds(store) {
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

// Returns an array of active feeds
export async function find_active_feeds(conn) {
  assert(conn instanceof IDBDatabase);
  const feeds = await get_feeds(conn);
  return feeds.filter(feed => feed.active);
}

// Calls the callback function on each feed in the store
// TODO: currently each call to the callback is blocked by waiting for the
// prior callback to complete, essentially a serial progression. This should
// directly interact with the database instead of using get_feeds and
// pre-loading into an array, and this should walk the feed store and call the
// callback per cursor walk, advancing the cursor PRIOR to calling the callback,
// taking advantage of the asynchronous nature of indexedDB cursor request
// callbacks. This will yield a minor speedup at the cost of being a mild DRY
// violation. However, the speed is admittedly not that important. This will
// also make the approach scalable to N feeds (until stack overflow).

export async function for_each_active_feed(conn, per_feed_callback) {
  const feeds = await get_feeds(conn);
  for (const feed of feeds) {
    per_feed_callback(feed);
  }
}

export function contains_entry_with_url(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(entry_is_valid_id(request.result));
    request.onerror = () => reject(request.error);
  });
}

export function find_feed_by_id(conn, id) {
  return new Promise((resolve, reject) => {
    assert(feed_is_valid_id(id));
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.get(id);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

export function contains_feed_with_url(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => {
      const feed_id = request.result;
      resolve(feed_is_valid_id(feed_id));
    };
    request.onerror = () => reject(request.error);
  });
}

export function find_viewable_entries(conn, offset, limit) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof IDBDatabase);
    if (offset !== null && typeof offset !== 'undefined') {
      assert(Number.isInteger(offset) && offset >= 0);
    }
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const txn = conn.transaction('entry');
    txn.oncomplete = _ => resolve(entries);
    txn.onerror = _ => reject(txn.error);
    const store = txn.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(key_path);
    request.onsuccess = _ => {
      const cursor = request.result;
      if (cursor) {
        if (offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if (limited && ++counter < limit) {
            cursor.continue();
          }
        }
      }
    };
  });
}

// Opens a cursor over the entry store for viewable entries starting from the
// given offset, and iterates up to the given limit, sequentially passing each
// deserialized entry to the per_entry_callback function. Returns a promise that
// resolves once all appropriate entries have been iterated. The promise rejects
// if an error occurs in indexedDB.
// @param conn {IDBDatabase}
// @param offset {Number}
// @param limit {Number}
// @param per_entry_callback {Function}
export function viewable_entries_for_each(
    conn, offset, limit, per_entry_callback) {
  return new Promise((resolve, reject) => {
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const txn = conn.transaction('entry');
    txn.oncomplete = resolve;
    txn.onerror = () => reject(txn.error);
    const store = txn.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(key_path);
    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
      if (cursor) {
        if (offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          // Put the request on the stack prior to the callback
          if (limited && ++counter < limit) {
            cursor.continue();
          }

          per_entry_callback(cursor.value);
        }
      }
    };
  });
}

export function get_feeds(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}



function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

export function feed_create() {
  return {magic: FEED_MAGIC};
}

// Return true if the value looks like a feed object
export function is_feed(value) {
  // While it perenially appears like the value condition is implied in the
  // typeof condition, this is not true. The value condition is short for value
  // !== null, because typeof null === 'object', and not checking value
  // definedness would cause value.magic to throw. The value condition is
  // checked first, because presumably it is cheaper than the typeof check.

  // indexedDB does not support storing Function objects, because Function
  // objects are not serializable (aka structured-cloneable), so we store basic
  // objects. Therefore, because instanceof is out of the question, and typeof
  // cannot get us any additional type guarantee beyond stating the value is
  // some object, we use a hidden property called magic to further guarantee the
  // type.
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function feed_is_valid_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function feed_has_url(feed) {
  assert(is_feed(feed));
  return feed.urls && (feed.urls.length > 0);
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
export function feed_peek_url(feed) {
  assert(feed_has_url(feed));
  return feed.urls[feed.urls.length - 1];
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param url {URL}
export function feed_append_url(feed, url) {
  if (!is_feed(feed)) {
    console.error('Invalid feed argument:', feed);
    return false;
  }

  if (!(url instanceof URL)) {
    console.error('Invalid url argument:', url);
    return false;
  }

  feed.urls = feed.urls || [];
  const href = url.href;
  if (feed.urls.includes(href)) {
    return false;
  }
  feed.urls.push(href);
  return true;
}

// Returns a new object that results from merging the old feed with the new
// feed. Fields from the new feed take precedence, except for urls, which are
// merged to generate a distinct ordered set of oldest to newest url. Impure
// because of copying by reference.
export function feed_merge(old_feed, new_feed) {
  const merged_feed = Object.assign(feed_create(), old_feed, new_feed);

  // After assignment, the merged feed has only the urls from the new feed. So
  // the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  merged_feed.urls = [...old_feed.urls];

  if (new_feed.urls) {
    for (const url_string of new_feed.urls) {
      feed_append_url(merged_feed, new URL(url_string));
    }
  }

  return merged_feed;
}

export function entry_create() {
  return {magic: ENTRY_MAGIC};
}

// Return true if the first parameter looks like an entry object
export function is_entry(value) {
  // note: typeof null === 'object', hence the truthy test
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Return true if the first parameter looks like an entry id
export function entry_is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Returns true if the entry has at least one url
export function entry_has_url(entry) {
  assert(is_entry(entry));
  return entry.urls && (entry.urls.length > 0);
}

// Returns the last url, as a string, in the entry's url list. This should never
// be called on an entry without urls.
// TODO: because this returns a string, be more explicit about it. I just caught
// myself expecting URL.
export function entry_peek_url(entry) {
  assert(is_entry(entry));
  assert(entry_has_url(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the urls property if
// needed. Normalizes the url. The normalized url is compared against existing
// urls to ensure the new url is unique. Returns true if entry was added, or
// false if the url already exists and was therefore not added
export function entry_append_url(entry, url) {
  assert(is_entry(entry));
  assert(url instanceof URL);

  const normal_url_string = url.href;
  if (entry.urls) {
    if (entry.urls.includes(normal_url_string)) {
      return false;
    }

    entry.urls.push(normal_url_string);
  } else {
    entry.urls = [normal_url_string];
  }

  return true;
}
