import {assert} from '/src/assert/assert.js';
import * as config_control from '/src/control/config-control.js';
import {replace_tags} from '/src/html/replace-tags.js';
import {truncate_html} from '/src/html/truncate-html.js';
import {indexeddb_open} from '/src/indexeddb/indexeddb-open.js';
import {condense_whitespace} from '/src/lang/condense-whitespace.js';
import {filter_control_characters} from '/src/lang/filter-control-characters.js';
import {filter_empty_properties} from '/src/lang/filter-empty-properties.js';
import {filter_unprintable_characters} from '/src/lang/filter-unprintable-characters.js';
import * as Entry from '/src/model/entry.js';
import * as Feed from '/src/model/feed.js';

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
  const blank_entry = Entry.create_entry();
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
