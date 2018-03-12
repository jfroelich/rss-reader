import {html_truncate} from '/src/html-truncate/html-truncate.js';
import {html_replace_tags} from '/src/html/html.js';
import {idb_open} from '/src/idb/idb.js';
import * as object from '/src/object/object.js';
import * as string from '/src/string/string.js';

const FEED_MAGIC = 0xfeedfeed;
const ENTRY_MAGIC = 0xdeadbeef;

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

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

// Marks a feed as active. This loads the feed, changes its properties, and
// then saves it again using a single transaction. Once the transaction
// resolves, a message is sent to the channel. Caller should take care to not
// close the channel before this settles. If this rejects with an error due to a
// closed channel, the database transaction has still committed.
// @param conn {IDBDatabase} an open database connection, required
// @param channel {BroadcastChannel} optional, the channel to receive a message
// about the state change
// @param feed_id {Number} the id of the feed to modify
// @throws {Error} database error, invalid input error, channel error, note
// these are technically rejections unless this is awaited
// @return {Promise} a promise that resolves
export function feed_activate(conn, channel, feed_id) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof IDBDatabase);
    assert(
        typeof channel === 'undefined' || channel === null ||
        channel instanceof BroadcastChannel);
    assert(feed_is_valid_id(feed_id));

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = () => {
      if (channel) {
        channel.postMessage({type: 'feed-activated', id: feed_id});
      }
      resolve();
    };
    txn.onerror = () => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = () => {
      const feed = request.result;
      assert(is_feed(feed));
      assert(!feed.active || !('active' in feed));
      feed.active = true;
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

// TODO: rather than reject when inactive, maybe just skip?
export function rdb_feed_deactivate(conn, channel, feed_id, reason_text) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof IDBDatabase);
    assert(
        typeof channel === 'undefined' || channel === null ||
        channel instanceof BroadcastChannel);
    assert(feed_is_valid_id(feed_id));

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = () => {
      if (channel) {
        channel.postMessage({type: 'feed-deactivated', id: feed_id});
      }
      resolve();
    };
    txn.onerror = () => reject(txn.error);
    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = () => {
      const feed = request.result;
      assert(feed.active || !('active' in feed));
      feed.active = false;
      feed.deactivationDate = new Date();
      feed.deactivationReasonText = reason_text;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

export async function entry_add(conn, channel, entry) {
  assert(conn instanceof IDBDatabase);
  assert(
      typeof channel === 'undefined' || channel === null ||
      channel instanceof BroadcastChannel);
  assert(is_entry(entry));
  assert(!('id' in entry) || entry.id === null || entry.id === void 0);

  // Throw an error if the entry object has any invalid properties
  assert(entry_is_valid(entry));

  // TODO: if I plan to have validation also occur in entry_sanitize, then
  // I think what should happen here is that I pass a no-revalidate flag along
  // to avoid revalidation because it could end up being a heavier operation

  const sanitized_entry = entry_sanitize(entry);
  const storable_entry = object.filter_empty_properties(sanitized_entry);

  // TODO: is it correct to have this be concerned with state initialization,
  // or should it be a responsibility of something earlier in the pipeline? I
  // revised put so that it does no property modification, because I don't like
  // the idea of implicit modification, and was trying to be more transparent.
  // That required all callers to set dateUpdated and increased inconvenience,
  // but it was overall good. Should I apply the same idea here?

  storable_entry.readState = ENTRY_STATE_UNREAD;
  storable_entry.archiveState = ENTRY_STATE_UNARCHIVED;
  storable_entry.dateCreated = new Date();

  // entry_put stores the value as is, and will not automatically add a
  // dateUpdated property, so this is sensible. New entries have never been
  // dirtied, and therefore should not have a date updated. Alternatively, this
  // could even throw an error. For the time being, it is more convenient to
  // just correct invalid input rather than reject it.
  delete storable_entry.dateUpdated;

  // TODO: I plan to add validate to put. I think in this case I need to pass
  // along a parameter that avoids duplicate validation. Here is where I would
  // do something like let no_revalidate = true;

  // Delegate the database work to put, because put can be used for both add and
  // put, and the two operations are nearly identical. However, do not supply
  // the input channel, so that its message is suppressed, so that add can send
  // its own message as a substitute. Rethrow any put errors as add errors.
  let void_channel;
  const entry_id = await entry_put(conn, void_channel, storable_entry);

  // Send our own message as a substitute for put's message
  if (channel) {
    channel.postMessage({type: 'entry-added', id: entry_id});
  }
  storable_entry.id = entry_id;
  return storable_entry;
}

// Return the number of unread entries in the database
// @param conn {IDBDatabase} an open database connection, required
// @return {Promise} a promise that resolves to the number of unread entries, or
// rejects with a database error
export function entry_count_unread(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Marks the entry corresponding to the entry_id as read in the database.
// @param conn {IDBDatabase} required
export function entry_mark_read(conn, channel, entry_id) {
  return new Promise((resolve, reject) => {
    assert(entry_is_valid_id(entry_id));

    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = () => {
      if (channel) {
        // TODO: maybe the try/catch isn't needed? If this is called unawaited,
        // then who cares if the rejection occurs? And when called awaited, it
        // is extremely unlikely the channel has been closed and moreover it
        // probably signals an actual error of premature channel close. I am
        // going to wait on that until I resolve the new non-auto-connect
        // requirement in which entry_mark_read is called

        // channel may be closed by the time this executes when
        // entry_mark_read is not awaited, so trap the invalid state error
        // and just log it
        try {
          channel.postMessage({type: 'entry-marked-read', id: entry_id});
        } catch (error) {
          console.debug(error);
        }
      }

      resolve();
    };
    txn.onerror = () => reject(txn.error);
    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = () => {
      const entry = request.result;

      // If there was no matching entry for the entry id, this is a programming
      // error.
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

// Returns the new id if adding
// This could be exported, but is not, as there is nothing that currently uses
// this functionality directly outside of this module.
// @param conn {IDBDatabase} required
// @param channel {BroadcastChannel} optional
// @param entry {object} required
function entry_put(conn, channel, entry) {
  return new Promise((resolve, reject) => {
    assert(conn instanceof IDBDatabase);
    if (channel) {
      assert(channel instanceof BroadcastChannel);
    }
    assert(is_entry(entry));
    const txn = conn.transaction('entry', 'readwrite');
    const store = txn.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => {
      const entry_id = request.result;
      if (channel) {
        channel.postMessage({type: 'entry-updated', id: entry_id});
      }
      resolve(entry_id);
    };
    request.onerror = () => reject(request.error);
  });
}

export function feed_prepare(feed) {
  return object.filter_empty_properties(feed_sanitize(feed));
}

// TODO: implement fully
// Return whether the feed has valid properties
// @param feed {any} any value, this should be a feed object, but it is not
// required
// @return {Boolean}
export function feed_is_valid(feed) {
  // feed_is_valid is generally called in the context of an assertion, so
  // while this could be its own assert, there is no need. It is simpler to
  // return here than throw an exception. It is, notably, generally an error to
  // ever call this function on something other than a feed, but that care is
  // left to the caller
  if (!is_feed(feed)) {
    return false;
  }

  // Validate the feed's id. It may not be present in the case of validating
  // a feed that has never been stored.
  if ('id' in feed && !feed_is_valid_id(feed.id)) {
    return false;
  }

  // NOTE: wait to fill out the rest of this until after finishing the
  // auto-connect deprecation

  return true;
}

// Add a feed to the database
// @param conn {IDBDatabase} an open database connection
// @param channel {BroadcastChannel} optional, the channel to receive a message
// about the feed being added
// @param feed {object} the feed to insert
// @return {Promise} resolves the object that was stored in the database, or
// rejects with an error (e.g. database error, invalid arguments)
export async function feed_add(conn, channel, feed) {
  // Delegate feed type check to feed_is_valid
  assert(feed_is_valid(feed));

  // Clone the feed, sanitize the clone, setup default props
  const prepared_feed = feed_prepare(feed);
  prepared_feed.active = true;
  prepared_feed.dateCreated = new Date();
  delete prepared_feed.dateUpdated;

  // Delegate database modification to feed_put. In doing so, suppress the
  // message from feed_put because we will post our own, and suppress
  // validation because we did it above.
  let void_channel;
  const validate = false;
  const feed_id =
      await feed_put(conn, void_channel, prepared_feed, validate);
  if (channel) {
    channel.postMessage({type: 'feed-added', id: feed_id});
  }

  prepared_feed.id = feed_id;
  return prepared_feed;
}

// Create or update a feed in the database
// @param conn {IDBDatabase}
// @param channel {BroadcastChannel} optional
// @param feed {object}
// @param validate {Boolean} optional
export function feed_put(conn, channel, feed, validate = true) {
  return new Promise((resolve, reject) => {
    if (validate) {
      // Defer is_feed call to validation in this case
      assert(feed_is_valid(feed));
    } else {
      // Otherwise provide minimal validation
      assert(is_feed(feed));
    }

    const txn = conn.transaction('feed', 'readwrite');
    const store = txn.objectStore('feed');
    const request = store.put(feed);
    // TODO: when updating, is put result still the feed id? I know
    // that result is feed id when adding, but what about updating? Review
    // the documentation on IDBObjectStore.prototype.put
    // So ... double check and warrant this resolves to an id
    request.onsuccess = () => {
      const feed_id = request.result;
      // Suppress invalid state error when channel is closed in non-awaited call
      // TODO: if awaited, I'd prefer to throw. How? Or, should it really just
      // be an error, and the caller is responsible for keeping this open?
      if (channel) {
        try {
          channel.postMessage({type: 'feed-updated', id: feed_id});
        } catch (error) {
          console.debug(error);
        }
      }
      resolve(feed_id);
    };
    request.onerror = () => reject(request.error);
  });
}

// Remove a feed any entries tied to the feed from the database
// @param conn {IDBDatabase}
// @param channel {BroadcastChannel} optional
// @param feed_id {Number}
// @param reason_text {String}
export function feed_remove(conn, channel, feed_id, reason_text) {
  return new Promise(function executor(resolve, reject) {
    assert(feed_is_valid_id(feed_id));
    let entry_ids;
    const txn = conn.transaction(['feed', 'entry'], 'readwrite');
    txn.oncomplete = _ => {
      if (channel) {
        channel.postMessage(
            {type: 'feed-deleted', id: feed_id, reason: reason_text});
        for (const id of entry_ids) {
          channel.postMessage(
              {type: 'entry-deleted', id: id, reason: reason_text});
        }
      }

      resolve(entry_ids);
    };
    txn.onerror = _ => reject(txn.error);

    const feed_store = txn.objectStore('feed');
    console.debug('Deleting feed with id', feed_id);
    feed_store.delete(feed_id);

    // Delete all entries belonging to the feed
    const entry_store = txn.objectStore('entry');
    const feed_index = entry_store.index('feed');
    const request = feed_index.getAllKeys(feed_id);
    request.onsuccess = function(event) {
      entry_ids = request.result;
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
    title = string.filter_control_characters(title);
    title = html_replace_tags(title, html_tag_replacement);
    title = string.condense_whitespace(title);
    title = html_truncate(title, title_max_length, suffix);
    output_feed.title = title;
  }

  if (output_feed.description) {
    let desc = output_feed.description;
    desc = string.filter_control_characters(desc);
    desc = html_replace_tags(desc, html_tag_replacement);
    desc = string.condense_whitespace(desc);
    desc = html_truncate(desc, description_max_length, suffix);
    output_feed.description = desc;
  }

  return output_feed;
}

// TODO: implement
function entry_is_valid(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  return true;
}

// Returns a new entry object where fields have been sanitized. Impure. Note
// that this assumes the entry is valid. As in, passing the entry to
// entry_is_valid before calling this function would return true. This does
// not revalidate. Sanitization is not validation. Here, sanitization acts more
// like a normalizing procedure, where certain properties are modified into a
// more preferable canonical form. A property can be perfectly valid, but
// nevertheless have some undesirable traits. For example, a string is required,
// but validation places no maximum length constraint on it, just requiredness,
// but sanitization also places a max length constraint on it and does the
// necessary changes to bring the entry into compliance via truncation.
// TODO: now that string.filter_unprintable_characters exists, I want to also
// filter such characters from input strings like author/title/etc. However it
// overlaps with the call to string.filter_control_characters here. There is
// some redundant work going on. Also, in a sense,
// string.filter_control_characters is now inaccurate. What I want is one
// function that strips binary characters except important ones, and then a
// second function that replaces or removes certain important binary characters
// (e.g. remove line breaks from author string). Something like
// 'string_replace_formatting_characters'.
function entry_sanitize(
    input_entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  // Create a shallow clone of the entry. This is partly the source of impurity.
  const blank_entry = entry_create();
  const output_entry = Object.assign(blank_entry, input_entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = string.filter_control_characters(author);
    author = html_replace_tags(author, '');
    author = string.condense_whitespace(author);
    author = html_truncate(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = string.filter_unprintable_characters(content);
    content = html_truncate(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = string.filter_control_characters(title);
    title = html_replace_tags(title, '');
    title = string.condense_whitespace(title);
    title = html_truncate(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
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

// Returns the url used to lookup a feed's favicon
// @returns {URL}
export function feed_create_favicon_lookup_url(feed) {
  assert(is_feed(feed));

  // First, prefer the link, as this is the url of the webpage that is
  // associated with the feed. Cannot assume the link is set or valid.
  if (feed.link) {
    try {
      return new URL(feed.link);
    } catch (error) {
      // If feed.link is set it should always be a valid URL
      console.warn(error);

      // If the url is invalid, just fall through
    }
  }

  // If the feed's link is missing/invalid then use the origin of the feed's
  // xml url. Assume the feed always has a url.
  const tail_url = new URL(feed_peek_url(feed));
  return new URL(tail_url.origin);
}
