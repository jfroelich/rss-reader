import {assert} from '/src/assert/assert.js';
import * as localstorage from '/src/browser/localstorage.js';
import {replace_tags} from '/src/html/replace-tags.js';
import {truncate_html} from '/src/html/truncate-html.js';
import {indexeddb_open} from '/src/indexeddb/indexeddb-open.js';
import {condense_whitespace} from '/src/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lang/filter-control-characters.js';
import {filter_empty_properties} from '/src/lang/filter-empty-properties.js';
import {filter_unprintable_characters} from '/src/lang/filter-unprintable-characters.js';

// indexedDB does not support storing Function objects, because Function objects
// are not serializable. Therefore instanceof and typeof are not usable for
// making assertions about type. Therefore, use a hidden "magic" property to
// enable some minimal form of type checking.
const FEED_MAGIC = 0xfeedfeed;
const ENTRY_MAGIC = 0xdeadbeef;

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

// This does not involve the database, but it does involve deep knowledge of the
// storage format. This creates an in memory object. Entry objects cannot be
// function objects, so set a magic property to fake a degree of type safety.
export function create_entry() {
  return {magic: ENTRY_MAGIC};
}

// Does not involve the database
export function create_feed() {
  return {magic: FEED_MAGIC};
}

export function count_unread_entries(conn) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry');
    const store = txn.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = _ => resolve(request.result);
    request.onerror = _ => reject(request.error);
  });
}

// Remove a feed and its entries, send a message to channel for each removal.
// If feed id does not exist then no error is thrown this is just a noop. reason
// is an optional, intended as categorical string.
export function delete_feed(conn, channel, feed_id, reason) {
  return new Promise((resolve, reject) => {
    // If not checked this would be a noop which is misleading
    if (!is_valid_feed_id(feed_id)) {
      throw new TypeError('Invalid feed id ' + feed_id);
    }

    const entry_ids = [];
    const txn = conn.transaction(['feed', 'entry'], 'readwrite');
    txn.oncomplete = _ => {
      const feed_msg = {};
      feed_msg.type = 'feed-deleted';
      feed_msg.id = feed_id;
      feed_msg.reason = reason;
      channel.postMessage(feed_msg);

      const entry_msg = {};
      entry_msg.type = 'entry-deleted';
      entry_msg.id = 0;
      entry_msg.reason = reason;
      entry_msg.feed_id = feed_id;  // retain correspondence when possible
      for (const id of entry_ids) {
        entry_msg.id = id;
        channel.postMessage(entry_msg);
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

// Deletes an entry from the database. Unlike delete_feed this does not expose
// feed id in its message because it would require an extra lookup.
export function delete_entry(conn, channel, id, reason) {
  return new Promise((resolve, reject) => {
    assert(is_valid_entry_id(id));  // prevent fake noops
    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      const msg = {type: 'entry-deleted', id: id, reason: reason};
      channel.postMessage(msg);
      resolve();
    };
    txn.onerror = _ => reject(txn.error);
    txn.objectStore('entry').delete(id);
  });
}

// Load an array of entries from the database
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
      const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
      request = index.openCursor(key_path);
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

      // Stop if limit defined and reached or surpassed limit
      if (limit > 0 && entries.length >= limit) {
        return;
      }

      cursor.continue();
    };
  });
}

// Find an entry in the database by mode id or mode url. If key only true then
// only basic entry loaded.
export function get_entry(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'id' || is_valid_entry_id(value));
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
        if (is_valid_entry_id(entry_id)) {
          entry = create_entry();
          entry.id = entry_id;
        }
      } else {
        entry = request.result;
      }

      resolve(entry);
    };
  });
}

// Find a feed in the database by id or by url
export function get_feed(conn, mode = 'id', value, key_only) {
  return new Promise((resolve, reject) => {
    assert(mode !== 'url' || (value && typeof value.href === 'string'));
    assert(mode !== 'id' || is_valid_feed_id(value));
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
        if (is_valid_feed_id(feed_id)) {
          feed = create_feed();
          feed.id = feed_id;
        }
      } else {
        feed = request.result;
      }

      resolve(feed);
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

export function get_feeds(conn, mode = 'all', sort = false) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('feed');
    const store = txn.objectStore('feed');
    const request = store.getAll();

    request.onerror = _ => reject(request.error);
    request.onsuccess = _ => {
      const feeds = request.result;
      if (sort) {
        feeds.sort(feed_compare);
      }

      if (mode === 'active') {
        resolve(feeds.filter(feed => feed.active));
      } else {
        resolve(feeds);
      }
    };
  });
}

function feed_compare(a, b) {
  const s1 = a.title ? a.title.toLowerCase() : '';
  const s2 = b.title ? b.title.toLowerCase() : '';
  return indexedDB.cmp(s1, s2);
}

export function mark_entry_read(conn, channel, entry_id) {
  return new Promise((resolve, reject) => {
    if (!is_valid_entry_id(entry_id)) {
      throw new TypeError('Invalid entry id ' + entry_id);
    }

    const txn = conn.transaction('entry', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'entry-read', id: entry_id});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');
    const request = store.get(entry_id);
    request.onsuccess = _ => {
      const entry = request.result;

      if (!entry) {
        reject(new Error('No entry found with id ' + entry_id));
        return;
      }

      if (!is_entry(entry)) {
        reject(new Error('Not an entry object for entry id ' + entry_id));
        return;
      }

      // Once an entry enters the archive state, it should require direct
      // property access to manipulate read state, so prevent access here. This
      // helper is only intended for use on unarchived entries
      if (entry.archiveState === ENTRY_STATE_ARCHIVED) {
        reject(
            new Error('Cannot mark archived entry as read for id ' + entry_id));
        return;
      }

      if (entry.readState === ENTRY_STATE_READ) {
        reject(new Error('Entry is already in read state for id ' + entry_id));
        return;
      }

      entry.readState = ENTRY_STATE_READ;
      const currentDate = new Date();
      entry.dateUpdated = currentDate;
      entry.dateRead = currentDate;

      request.source.put(entry);
    };
  });
}

export function iterate_entries(conn, mode = 'all', writable, handle_entry) {
  return new Promise((resolve, reject) => {
    const txn = conn.transaction('entry', writable ? 'readwrite' : 'readonly');
    txn.oncomplete = resolve;
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('entry');

    let request;
    if (mode === 'archive') {
      const index = store.index('archiveState-readState');
      const key_path = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_READ];
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
  version = isNaN(version) ? localstorage.read_int('db_version') : version;
  timeout = isNaN(timeout) ? localstorage.read_int('db_open_timeout') : timeout;

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

// Walk over the entry store one entry at a time and set the magic property for
// each entry. This returns prior to the operation completing.
// @param txn {IDBTransaction}
// @return {void}
function add_magic_to_entries(txn) {
  console.debug('Adding entry magic');
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
      feed.magic = FEED_MAGIC;
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

// Returns a new entry object where fields have been sanitized. Impure. Note
// that this assumes the entry is valid. As in, passing the entry to
// is_valid_entry before calling this function would return true. This does not
// revalidate. Sanitization is not validation. Here, sanitization acts more like
// a normalizing procedure, where certain properties are modified into a more
// preferable canonical form. A property can be perfectly valid, but
// nevertheless have some undesirable traits. For example, a string is required,
// but validation places no maximum length constraint on it, just required-ness,
// but sanitization also places a max length constraint on it and does the
// necessary changes to bring the entry into compliance via truncation.
export function sanitize_entry(
    entry, author_max_length = 200, title_max_length = 1000,
    content_max_length = 50000) {
  // Create a shallow clone for purity
  const blank_entry = create_entry();
  const output_entry = Object.assign(blank_entry, entry);

  if (output_entry.author) {
    let author = output_entry.author;
    author = filter_control_characters(author);
    author = replace_tags(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_length);
    output_entry.author = author;
  }

  if (output_entry.content) {
    let content = output_entry.content;
    content = filter_unprintable_characters(content);
    content = truncate_html(content, content_max_length);
    output_entry.content = content;
  }

  if (output_entry.title) {
    let title = output_entry.title;
    title = filter_control_characters(title);
    title = replace_tags(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_length);
    output_entry.title = title;
  }

  return output_entry;
}

// Cleans/normalizes certain properties of the feed
export function sanitize_feed(feed, options) {
  options = options || {};
  const title_max_len = options.title_max_len || 1024;
  const desc_max_len = options.desc_max_len || 1024 * 10;

  const html_tag_replacement = '';
  const repl_suffix = '';

  if (feed.title) {
    let title = feed.title;
    title = filter_control_characters(title);
    title = replace_tags(title, html_tag_replacement);
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len, repl_suffix);
    feed.title = title;
  }

  if (feed.description) {
    let desc = feed.description;
    desc = filter_control_characters(desc);
    desc = replace_tags(desc, html_tag_replacement);
    desc = condense_whitespace(desc);
    desc = truncate_html(desc, desc_max_len, repl_suffix);
    feed.description = desc;
  }
}

// Creates or overwrites an entry object in the app database. Impure.
// dateUpdated is set automatically. The entry is not sanitized nor validated.
// Some initial state is supplied automatically, such as marking a new entry as
// unread. If creating, then the id property should not exist. The database is
// modified even when a post message error occurs.
export function update_entry(conn, channel, entry) {
  return new Promise((resolve, reject) => {
    if (!is_entry(entry)) {
      throw new TypeError('Invalid entry argument ' + entry);
    }

    const creating = !entry.id;
    if (creating) {
      entry.readState = ENTRY_STATE_UNREAD;
      entry.archiveState = ENTRY_STATE_UNARCHIVED;
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

// Updates one or more properties of a feed in the database. Once the database
// transaction completes, a message is sent to the channel. dateUpdated is
// automatically set to the current date unless the property itself is specified
// as one of the properties to change.
export function update_feed_properties(
    conn, channel, feed_id, name, value, extra_props = {}) {
  return new Promise((resolve, reject) => {
    assert(is_valid_feed_id(feed_id));
    assert(typeof name === 'string' && name);
    assert(name !== 'id');  // refuse setting this particular prop

    const txn = conn.transaction('feed', 'readwrite');
    txn.oncomplete = _ => {
      channel.postMessage({type: 'feed-written', id: feed_id, property: name});
      resolve();
    };
    txn.onerror = _ => reject(txn.error);

    const store = txn.objectStore('feed');
    const request = store.get(feed_id);
    request.onsuccess = _ => {
      const feed = request.result;
      assert(feed);           // indicates bad id or unexpected state
      assert(is_feed(feed));  // corrupted state

      const run_date = new Date();

      if (name === 'active') {
        // TODO: use asserts here
        if (feed.active && value) {
          console.error(
              'Tried to activate active feed (invalid state) %d', feed_id);
          return;
        } else if (!feed.active && !value) {
          console.error(
              'Tried to deactivate inactive feed (invalid state) %d', feed_id);
          return;
        }

        // Set functional dependencies
        if (value === true) {
          delete feed.deactivationReasonText;
          delete feed.deactivateDate;
        } else if (value === false) {
          if (typeof extra_props.reason === 'string') {
            feed.deactivationReasonText = extra_props.reason;
          } else {
            delete feed.deactivationReasonText;
          }
          feed.deactivateDate = run_date;
        } else {
          // If undefining, cleanup
          // TODO: is this case of undefined even allowed? might not make sense
          // TODO: if these fields do not even exist, should I try to no-op?
          delete feed.deactivationReasonText;
          delete feed.deactivateDate;
        }
      }

      if (typeof value === 'undefined') {
        // Remove the property rather than set to undefined. Normally frowned
        // upon because we want to maintain v8 object shape, but in this case it
        // actually reduces disk space.
        delete feed[name];
      } else {
        feed[name] = value;
      }

      if (name !== 'dateUpdated') {
        feed.dateUpdated = run_date;
      }

      request.source.put(feed);
    };
  });
}

// Creates or updates a feed in the database
export function update_feed(conn, channel, feed) {
  return new Promise((resolve, reject) => {
    assert(is_feed(feed));
    assert(feed.urls && feed.urls.length);

    filter_empty_properties(feed);

    const is_create = !('id' in feed);
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

    // result is id in both cases, but only care about create
    if (is_create) {
      request.onsuccess = _ => feed.id = request.result;
    }
  });
}

// Returns whether an entry is valid. Only partially implemented
export function is_valid_entry(entry) {
  if (!is_entry(entry)) {
    return false;
  }

  // This could be called on a new entry that does not have an id, so only
  // check id validity when the property exists
  if ('id' in entry) {
    if (!is_valid_entry_id(entry.id)) {
      console.warn('Invalid id', entry.id);
      return false;
    }
  }

  return true;
}

// Returns whether the feed is valid
export function is_valid_feed(feed) {
  if (!is_feed(feed)) {
    return false;
  }

  if ('id' in feed && !is_valid_feed_id(feed.id)) {
    return false;
  }

  if (!['undefined', 'string'].includes(typeof feed.title)) {
    return false;
  }

  if ('urls' in feed && !Array.isArray(feed.urls)) {
    return false;
  }

  return true;
}

// Return true if the first parameter looks like an entry object
export function is_entry(value) {
  // Function objects are not allowed, hence the pedantic tests and the duck
  // typing
  // NOTE: typeof null === 'object', hence the preceding truthy test
  // NOTE: uses extended check in order to exclude function objects
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Return true if the first parameter looks like an entry id
export function is_valid_entry_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Append a url to an entry's url list. Lazily creates the urls property if
// needed. Normalizes the url. The normalized url is compared against existing
// urls to ensure the new url is unique. Returns true if entry was added, or
// false if the url already exists and was therefore not added.
export function append_entry_url(entry, url) {
  if (!is_entry(entry)) {
    throw new TypeError('Invalid entry parameter ' + entry);
  }

  // Prefer duck typing over instanceof, assume string
  if (!url.href) {
    throw new TypeError('Invalid url parameter ' + url);
  }

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

// Return true if the value looks like a feed object. While it perenially
// appears like the value condition is implied in the typeof condition, this is
// not true. The value condition is short for `value !== null`, because `typeof
// null === 'object'`, and not checking value defined-ness would cause
// value.magic to throw. The value condition is checked first, because
// presumably it is cheaper than the typeof check.
export function is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// * @param feed {Object} a feed object
// * @param url {URL}
export function append_feed_url(feed, url) {
  if (!is_feed(feed)) {
    throw new TypeError('Invalid feed argument ' + feed);
    return false;
  }

  // Duck-typed sanity check
  const href = url.href;
  if (typeof href !== 'string') {
    throw new TypeError('Invalid url argument ' + url);
    return false;
  }

  // Lazy init
  if (!feed.urls) {
    feed.urls = [];
  }

  if (feed.urls.includes(href)) {
    return false;
  }
  feed.urls.push(href);
  return true;
}

export function set_feed_date_fetched(feed, date) {
  feed.dateFetched = date;
}

export function set_feed_date_last_modified(feed, date) {
  feed.dateLastModifed = date;
}

export function set_feed_date_published(feed, date) {
  feed.datePublished = date;
}

export function set_feed_description(feed, description) {
  feed.description = description;
}

export function set_feed_link(feed, url_string) {
  feed.link = url_string;
}

export function set_feed_title(feed, title) {
  feed.title = title;
}

// Set the type property, which indicates whether the feed is rss/atom/etc
export function set_feed_type(feed, feed_type_string) {
  feed.type = feed_type_string;
}

export function is_valid_feed_id(id) {
  return Number.isInteger(id) && id > 0;
}
