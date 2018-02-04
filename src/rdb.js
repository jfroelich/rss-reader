import {html_replace_tags, html_truncate} from '/src/common/html-utils.js';
import {open as indexeddb_utils_open} from '/src/common/indexeddb-utils.js';

// TODO: do away with all auto-connecting. The solution to inconvenient resource
// lifetime management is through using wrapper functions, not through dynamic
// variables

// TODO: move this to github issue
// TODO: rename feed.dateUpdated and entry.dateUpdated to updatedDate for better
// consistency

// TODO: move this to github issue as a mental note
// TODO: consider grouping feed.active properties together

const FEED_MAGIC = 0xfeedfeed;
const ENTRY_MAGIC = 0xdeadbeef;

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

export function open(name = 'reader', version = 24, timeout = 500) {
  return indexeddb_utils_open(name, version, on_upgrade_needed, timeout);
}

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
function on_upgrade_needed(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feed_store, entry_store;
  const stores = conn.objectStoreNames;

  console.log(
      'Upgrading database %s to version %s from version', conn.name,
      conn.version, event.oldVersion);

  if (event.oldVersion < 20) {
    feed_store =
        conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
    entry_store =
        conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});
    feed_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});

    entry_store.createIndex('readState', 'readState');
    entry_store.createIndex('feed', 'feed');
    entry_store.createIndex(
        'archiveState-readState', ['archiveState', 'readState']);
    entry_store.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  } else {
    feed_store = tx.objectStore('feed');
    entry_store = tx.objectStore('entry');
  }

  if (event.oldVersion < 21) {
    // Add magic to all older entries
    add_entry_magic(tx);
  }

  if (event.oldVersion < 22) {
    add_feed_magic(tx);
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

// Expects the transaction to be writable (either readwrite or versionchange)
function add_entry_magic(tx) {
  console.debug('Adding entry magic');
  const store = tx.objectStore('entry');
  const get_all_entries_request = store.getAll();
  get_all_entries_request.onerror = function(event) {
    console.error(get_all_entries_request.error);
  };
  get_all_entries_request.onsuccess = function(event) {
    const entries = event.target.result;
    write_entries_with_magic(store, entries);
  };
}

function write_entries_with_magic(entry_store, entries) {
  for (const entry of entries) {
    entry.magic = ENTRY_MAGIC;
    entry.dateUpdated = new Date();
    entry_store.put(entry);
  }
}

function add_feed_magic(tx) {
  console.debug('Adding feed magic');
  const store = tx.objectStore('feed');
  const get_all_feeds_request = store.getAll();
  get_all_feeds_request.onerror = console.error;
  get_all_feeds_request.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

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

export async function reader_db_activate_feed(conn, channel, feed_id) {
  assert(feed_is_valid_id(feed_id), 'Invalid feed id', feed_id);
  const dconn = conn ? conn : await open();
  await activate_feed_promise(dconn, feed_id);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    channel.postMessage({type: 'feed-activated', id: feed_id});
  }
}

function activate_feed_promise(conn, feed_id) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = () => {
      const feed = request.result;
      assert(feed, 'Could not find feed', feed_id);
      assert(!feed.active, 'Feed is already active ' + feed_id);
      feed.active = true;
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

export async function reader_db_deactivate_feed(
    conn, channel, feed_id, reasonText) {
  assert(feed_is_valid_id(feed_id), 'Invalid feed id ' + feed_id);
  const dconn = conn ? conn : await open();
  await deactivate_feed_promise(dconn, feed_id, reasonText);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    channel.postMessage({type: 'feed-deactivated', id: feed_id});
  }
}

function deactivate_feed_promise(conn, feed_id, reasonText) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = () => {
      const feed = request.result;
      assert(feed, 'Could not find feed', feed_id);
      assert(feed.active, 'Feed is inactive', feed_id);
      feed.active = false;
      feed.deactivationDate = new Date();
      feed.deactivationReasonText = reasonText;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

// TODO: should validation be caller concern
// TODO: I wonder if sanitization is a concern for something earlier in the
// processing pipeline, and at this point, only validation is a concern, and
// no magical mutations should happen

export async function entry_store_add_entry(conn, channel, entry) {
  assert(entry_is_entry(entry), 'Invalid entry ' + entry);
  assert(!entry.id);
  entry_validate(entry);

  const sanitized = entry_sanitize(entry);
  const storable = object_filter_empty_properties(sanitized);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  delete storable.dateUpdated;

  let nullChannel = null;
  const entry_id = await putEntry(conn, nullChannel, storable);
  if (channel) {
    channel.postMessage({type: 'entry-added', id: entry_id});
  }
  storable.id = entry_id;
  return storable;
}

export async function reader_db_count_unread_entries(conn) {
  const dconn = conn ? conn : await open();
  const count = await count_unread_entries_promise(dconn);
  if (!conn) {
    dconn.close();
  }
  return count;
}

function count_unread_entries_promise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function entry_mark_read(conn, channel, entry_id) {
  assert(entry_is_valid_id(entry_id));
  const dconn = conn ? conn : await open();
  await mark_entry_read_promise(dconn, entry_id);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    // channel may be closed by the time this executes when entry_mark_read is
    // not awaited, so trap the invalid state error and just log it
    try {
      channel.postMessage({type: 'entry-marked-read', id: entry_id});
    } catch (error) {
      console.debug(error);
    }
  }
}

function mark_entry_read_promise(conn, entry_id) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = () => {
      const entry = request.result;
      assert(entry);
      if (entry.readState === ENTRY_STATE_READ) {
        console.warn('Entry %d already in read state, ignoring', entry.id);
        return;
      }
      if (entry.readState !== ENTRY_STATE_UNREAD) {
        console.warn('Entry %d not in unread state, ignoring', entry.id);
        return;
      }
      entry.readState = ENTRY_STATE_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;
      store.put(entry);
    };
  });
}

export async function find_active_feeds(conn) {
  const feeds = await reader_db_get_feeds(conn);
  return feeds.filter(feed => feed.active);
}

export async function reader_db_for_each_active_feed(conn, per_feed_callback) {
  const feeds = await reader_db_get_feeds(conn);
  for (const feed of feeds) {
    per_feed_callback(feed);
  }
}

// TODO: inline
async function find_entry_id_by_url(conn, url) {
  const dconn = conn ? conn : await open();
  const entry_id = await find_entry_id_by_url_promise(dconn, url);
  if (!conn) {
    dconn.close();
  }
  return entry_id;
}

function find_entry_id_by_url_promise(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function entry_store_contains_entry_with_url(conn, url) {
  const entry_id = await find_entry_id_by_url(conn, url);
  return entry_is_valid_id(entry_id);
}

export async function reader_db_find_feed_by_id(conn, feed_id) {
  const dconn = conn ? conn : await open();
  const feed = await find_feed_by_id_promise(dconn, feed_id);
  if (!conn) {
    dconn.close();
  }
  return feed;
}

function find_feed_by_id_promise(conn, feed_id) {
  return new Promise((resolve, reject) => {
    assert(feed_is_valid_id(feed_id));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: inline
async function find_feed_id_by_url(conn, url) {
  const dconn = conn ? conn : await open();
  const feed_id = await find_feed_id_by_url_promise(dconn, url);
  if (!conn) {
    dconn.close();
  }
  return feed_id;
}

function find_feed_id_by_url_promise(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function feed_store_contains_feed_with_url(conn, url) {
  const feed_id = await find_feed_id_by_url(conn, url);
  return feed_is_valid_id(feed_id);
}

export async function reader_db_find_viewable_entries(conn, offset, limit) {
  const dconn = conn ? conn : await open();
  const entries = await find_viewable_entries_promise(dconn, offset, limit);
  if (!conn) {
    dconn.close();
  }
  return entries;
}

function find_viewable_entries_promise(conn, offset, limit) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = () => resolve(entries);
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
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
export function reader_db_viewable_entries_for_each(
    conn, offset, limit, per_entry_callback) {
  return new Promise((resolve, reject) => {
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function request_onsuccess(event) {
      const cursor = event.target.result;
      if (cursor) {
        if (offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          // per_entry_callback is a blocking synchronous call. If called prior
          // to advancing the cursor then the cursor.continue call does not
          // start until per_entry_callback exists. Instead, call the handler
          // after already requesting the cursor to advance, so it does not have
          // to wait.

          if (limited && ++counter < limit) {
            cursor.continue();
          }

          per_entry_callback(cursor.value);
        }
      }
    };
  });
}


export async function reader_db_get_feeds(conn) {
  const dconn = conn ? conn : await open();
  const feeds = await get_feeds_promise(dconn);
  if (!conn) {
    dconn.close();
  }
  return feeds;
}

function get_feeds_promise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putEntry(conn, channel, entry) {
  const dconn = conn ? conn : await open();
  const entry_id = await put_entry_promise(dconn, entry);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    channel.postMessage({type: 'entry-updated', id: entry_id});
  }
  return entry_id;
}

function put_entry_promise(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(entry_is_entry(entry));
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function feed_prepare(feed) {
  return object_filter_empty_properties(feed_sanitize(feed));
}

// TODO: validateFeed (here or in feed_store_feed_put)
export async function feed_store_add(conn, channel, feed) {
  const prepared_feed = feed_prepare(feed);
  prepared_feed.active = true;
  prepared_feed.dateCreated = new Date();
  delete prepared_feed.dateUpdated;
  const feed_id = await feed_store_feed_put(conn, null, prepared_feed);
  prepared_feed.id = feed_id;
  if (channel) {
    channel.postMessage({type: 'feed-added', id: feed_id});
  }
  return prepared_feed;
}

export async function feed_store_feed_put(conn, channel, feed) {
  const dconn = conn ? conn : await open();
  const feed_id = await put_feed_promise(dconn, feed);
  if (!conn) {
    dconn.close();
  }

  // Suppress invalid state error when channel is closed in non-awaited call
  // TODO: if awaited, I'd prefer to throw. How?
  if (channel) {
    try {
      channel.postMessage({type: 'feed-updated', id: feed_id});
    } catch (error) {
      console.debug(error);
    }
  }

  return feed_id;
}

function put_feed_promise(conn, feed) {
  return new Promise((resolve, reject) => {
    assert(feed_is_feed(feed));
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    // TODO: when updating, is put result still the feed id? I know
    // that result is feed id when adding, but what about updating? Review
    // the documentation on IDBObjectStore.prototype.put
    // So ... double check and warrant this resolves to an id
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function feed_store_remove_feed(
    conn, channel, feed_id, reasonText) {
  const dconn = conn ? conn : await open();
  const entry_ids = await remove_feed_promise(dconn, feedid);
  if (!conn) {
    dconn.close();
  }

  if (channel) {
    channel.postMessage(
        {type: 'feed-deleted', id: feed_id, reason: reasonText});
    for (const id of entry_ids) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: reasonText});
    }
  }
}

function remove_feed_promise(conn, feed_id) {
  return new Promise(function executor(resolve, reject) {
    assert(feed_is_valid_id(feed_id));
    let entry_ids;
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve(entry_ids);
    tx.onerror = () => reject(tx.error);

    const feed_store = tx.objectStore('feed');
    console.debug('Deleting feed with id', feed_id);
    feed_store.delete(feed_id);

    // Get all entry ids for the feed and then delete them
    const entry_store = tx.objectStore('entry');
    const feed_index = entry_store.index('feed');
    const request = feed_index.getAllKeys(feed_id);
    request.onsuccess = function(event) {
      entry_ids = request.result;

      // Fire off all the requests concurrently without waiting for any one
      // to resolve. Eventually they all will resolve and the transaction
      // will complete and then the promise resolves.
      for (const id of entry_ids) {
        console.debug('Deleting entry', id);
        entry_store.delete(id);
      }
    };
  });
}

// Returns a shallow copy of the input feed with sanitized properties
function feed_sanitize(feed, title_max_length, description_max_length) {
  if (typeof title_max_length === 'undefined') {
    title_max_length = 1024;
  }

  if (typeof description_max_length === 'undefined') {
    description_max_length = 1024 * 10;
  }

  const blank_feed = feed_create();
  const output_feed = Object.assign(blank_feed, feed);
  const html_tag_replacement = '';
  const suffix = '';

  if (output_feed.title) {
    let title = output_feed.title;
    title = string_filter_control_characters(title);
    title = html_replace_tags(title, html_tag_replacement);
    title = string_condense_whitespace(title);
    title = html_truncate(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if (output_feed.description) {
    let desc = output_feed.description;
    desc = string_filter_control_characters(desc);
    desc = html_replace_tags(desc, html_tag_replacement);
    desc = string_condense_whitespace(desc);
    desc = html_truncate(desc, description_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

// Inspect the entry object and throw an error if any value is invalid
// or any required properties are missing
function entry_validate(entry) {
  // TODO: implement
  // By not throwing an error, this indicates the entry is valid
}

// Returns a new entry object where fields have been sanitized. Impure
// TODO: now that string_filter_unprintable_characters is a thing, I want to
// also filter such characters from input strings like author/title/etc. However
// it overlaps with the call to string_filter_control_characters here. There is
// some redundant work going on. Also, in a sense,
// string_filter_control_characters is now inaccurate. What I want is one
// function that strips binary characters except important ones, and then a
// second function that replaces or removes certain important binary characters
// (e.g. remove line breaks from author string). Something like
// 'replaceFormattingCharacters'.
function entry_sanitize(
    input_entry, author_max_length, title_max_length, content_max_length) {
  if (typeof author_max_length === 'undefined') {
    author_max_length = 200;
  }

  if (typeof title_max_length === 'undefined') {
    title_max_length = 1000;
  }

  if (typeof content_max_length === 'undefined') {
    content_max_length = 50000;
  }

  const blank_entry = entry_create();
  const output_entry = Object.assign(blank_entry, input_entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = string_filter_control_characters(author);
    author = html_replace_tags(author, '');
    author = string_condense_whitespace(author);
    author = html_truncate(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = string_filter_unprintable_characters(content);
    content = html_truncate(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = string_filter_control_characters(title);
    title = html_replace_tags(title, '');
    title = string_condense_whitespace(title);
    title = html_truncate(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}

function string_condense_whitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
function object_filter_empty_properties(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};
  let undef;
  if (typeof object === 'object' && object !== null) {
    for (const key in object) {
      if (hasOwnProp.call(object, key)) {
        const value = object[key];
        if (value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}

// If the input is a string then the function returns a new string that is
// approximately a copy of the input less certain 'unprintable' characters. In
// the case of bad input the input itself is returned. To test if characters
// were replaced, check if the output string length is less than the input
// string length.
function string_filter_unprintable_characters(value) {
  // Basically this removes those characters in the range of [0..31] except for:
  // \t is \u0009 which is base10 9
  // \n is \u000a which is base10 10
  // \f is \u000c which is base10 12
  // \r is \u000d which is base10 13
  // TODO: look into how much this overlaps with
  // string_filter_control_characters

  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
  // The length check is done because given that replace will be a no-op when
  // the length is 0 it is faster to perform the length check than it is to call
  // replace. I do not know the distribution of inputs but I expect that empty
  // strings are not rare.
  return typeof value === 'string' && value.length ?
      value.replace(pattern, '') :
      value;
}

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string. Adapted from these stack
// overflow questions: http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function string_filter_control_characters(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

export function feed_create() {
  return {magic: FEED_MAGIC};
}

// Return true if the value looks like a feed object
export function feed_is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function feed_is_valid_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function feed_has_url(feed) {
  assert(feed_is_feed(feed));
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
  if (!feed_is_feed(feed)) {
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
export function feed_merge(oldFeed, newFeed) {
  const mergedFeed = Object.assign(feed_create(), oldFeed, newFeed);

  // After assignment, the merged feed has only the urls from the new feed. So
  // the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  mergedFeed.urls = [...oldFeed.urls];

  if (newFeed.urls) {
    for (const urlString of newFeed.urls) {
      feed_append_url(mergedFeed, new URL(urlString));
    }
  }

  return mergedFeed;
}

export function entry_create() {
  return {magic: ENTRY_MAGIC};
}

// Return true if the first parameter looks like an entry object
export function entry_is_entry(value) {
  // note: typeof null === 'object', hence the truthy test
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Return true if the first parameter looks like an entry id
export function entry_is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Returns true if the entry has at least one url
export function entry_has_url(entry) {
  assert(entry_is_entry(entry));
  return entry.urls && (entry.urls.length > 0);
}

// Returns the last url, as a string, in the entry's url list. This should never
// be called on an entry without urls.
// TODO: because this returns a string, be more explicit about it. I just caught
// myself expecting URL.
export function entry_peek_url(entry) {
  assert(entry_is_entry(entry));
  assert(entry_has_url(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the urls property if
// needed. Normalizes the url. The normalized url is compared against existing
// urls to ensure the new url is unique. Returns true if entry was added, or
// false if the url already exists and was therefore not added
export function entry_append_url(entry, url) {
  assert(entry_is_entry(entry));
  assert(url instanceof URL);

  const normalUrlString = url.href;
  if (entry.urls) {
    if (entry.urls.includes(normalUrlString)) {
      return false;
    }

    entry.urls.push(normalUrlString);
  } else {
    entry.urls = [normalUrlString];
  }

  return true;
}

// Returns the url used to lookup a feed's favicon
// Note this expects an actual feed object, not any object. The magic property
// must be set
// @returns {URL}
export function feed_create_favicon_lookup_url(feed) {
  assert(feed_is_feed(feed));

  // First, prefer the link, as this is the url of the webpage that is
  // associated with the feed. Cannot assume the link is set or valid. But if
  // set, can assume it is valid.
  if (feed.link) {
    try {
      return new URL(feed.link);
    } catch (error) {
      // If feed.link is set it should always be a valid URL
      console.warn(error);

      // If the url is invalid, just fall through
    }
  }

  // If the link is missing or invalid then use the origin of the feed's xml
  // url. Assume the feed always has a url.
  const urlString = feed_peek_url(feed);
  const urlObject = new URL(urlString);
  return new URL(urlObject.origin);
}
