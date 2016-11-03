// See license.md

'use strict';

// TODO: name anonymous functions for simpler debugging

// TODO: add/update feed should delegate to put feed
// TODO: maybe merge add/put entry into one function
// TODO: maybe entry states should be in a single property instead of
// two props, like UNREAD_UNARCHIVED
// TODO: remove the defined feed title requirement, have options manually sort
// feeds instead of using the title index, deprecate the title index, stop
// ensuring title is an empty string. note: i partly did some of this

const ENTRY_UNREAD = 0;
const ENTRY_READ = 1;
const ENTRY_UNARCHIVED = 0;
const ENTRY_ARCHIVED = 1;

// TODO: if 99% of use cases involve the default name and version, it would
// make more sense to have log as the first parameter, because I could use
// db_connect(console) in most places. The only time I do not use the global
// config defaults is in a test context.

function db_connect(name = config.db_name, version = config.db_version,
  log = SilentConsole) {

  // idb allows empty string, but I think this leads to confusion, so do
  // not allow unnamed database
  if(!name.length) {
    throw new TypeError();
  }

  return new Promise(function connect_impl(resolve, reject) {
    log.log('Connecting to database', name, version);
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = db_upgrade.bind(request, log);
    request.onsuccess = function onsuccess(event) {
      const conn = event.target.result;
      log.debug('Connected to database', conn.name);
      resolve(conn);
    };
    request.onerror = function onerror(event) {
      reject(event.target.error);
    };
    request.onblocked = function onblocked(event) {
      log.warn('db connection request blocked, waiting indefinitely');
    };
  });
}


// TODO: revert upgrade to using a version migration approach
// NOTE: untested after switch to promise
function db_upgrade(log, event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feed_store = null, entry_store = null;
  const stores = conn.objectStoreNames;

  console.dir(event);
  log.log('Upgrading database %s to version %s from version', conn.name,
    event.version, event.oldVersion);

  if(stores.contains('feed')) {
    feed_store = tx.objectStore('feed');
  } else {
    feed_store = conn.createObjectStore('feed', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  if(stores.contains('entry')) {
    entry_store = tx.objectStore('entry');
  } else {
    entry_store = conn.createObjectStore('entry', {
      'keyPath': 'id',
      'autoIncrement': true
    });
  }

  const feed_indices = feed_store.indexNames;
  const entry_indices = entry_store.indexNames;

  // Deprecated
  if(feed_indices.contains('schemeless'))
    feed_store.deleteIndex('schemeless');
  // Deprecated. Use the new urls index
  if(feed_indices.contains('url'))
    feed_store.deleteIndex('url');

  // Create a multi-entry index using the new urls property, which should
  // be an array of unique strings of normalized urls
  if(!feed_indices.contains('urls'))
    feed_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });

  // TODO: deprecate this, have the caller manually sort and stop requiring
  // title, this just makes it difficult.
  if(!feed_indices.contains('title'))
    feed_store.createIndex('title', 'title');

  // Deprecated
  if(entry_indices.contains('unread'))
    entry_store.deleteIndex('unread');

  // For example, used to count the number of unread entries
  if(!entry_indices.contains('readState'))
    entry_store.createIndex('readState', 'readState');

  if(!entry_indices.contains('feed'))
    entry_store.createIndex('feed', 'feed');

  if(!entry_indices.contains('archiveState-readState'))
    entry_store.createIndex('archiveState-readState',
      ['archiveState', 'readState']);

  // Deprecated. Use the urls index instead.
  if(entry_indices.contains('link'))
    entry_store.deleteIndex('link');

  // Deprecated. Use the urls index instead.
  if(entry_indices.contains('hash'))
    entry_store.deleteIndex('hash');

  if(!entry_indices.contains('urls'))
    entry_store.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
}

function db_delete(name) {
  return new Promise(function delete_impl(resolve, reject) {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = function delete_onsuccess(event) {
      resolve();
    };
    request.onerror = function delete_onerror(event) {
      reject(event.target.error);
    };
  });
}



function get_feed_url(feed) {
  if(!feed.urls.length)
    throw new TypeError();
  return feed.urls[feed.urls.length - 1];
}

function add_feed_url(feed, url) {
  if(!('urls' in feed))
    feed.urls = [];

  const norm_url = normalize_feed_url(url);
  if(feed.urls.includes(norm_url)) {
    return false;
  }

  feed.urls.push(norm_url);
  return true;
}

function normalize_feed_url(url_str) {
  const url_obj = new URL(url_str);
  // # can be used to identify a different url
  //url_obj.hash = '';
  return url_obj.href;
}

function sanitize_feed(input_feed) {
  const feed = Object.assign({}, input_feed);

  if(feed.id) {
    if(!Number.isInteger(feed.id) || feed.id < 1)
      throw new TypeError();
  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type && !(feed.type in types))
    throw new TypeError();

  if(feed.title) {
    let title = feed.title;
    title = filter_control_chars(title);
    title = replace_tags(title, '');
    title = title.replace(/\s+/, ' ');
    const title_max_len = 1024;
    title = truncate_html(title, title_max_len, '');
    feed.title = title;
  }

  if(feed.description) {
    let description = feed.description;
    description = filter_control_chars(description);
    description = replace_tags(description, '');
    description = description.replace(/\s+/, ' ');
    const before_len = description.length;
    const desc_max_len = 1024 * 10;
    description = truncate_html(description, desc_max_len, '');
    if(before_len > description.length) {
      console.warn('Truncated description', description);
    }

    feed.description = description;
  }

  return feed;
}

// Returns a new object of the old feed merged with the new feed. Fields from
// the new feed take precedence, except for URLs, which are merged to generate
// a distinct ordered set of oldest to newest url. Impure.
function merge_feeds(old_feed, new_feed) {
  const merged = Object.assign({}, old_feed, new_feed);
  merged.urls = [...old_feed.urls];
  for(let url of new_feed.urls) {
    add_feed_url(merged, url);
  }
  return merged;
}


// Get the last url in an entry's internal url list
function get_entry_url(entry) {
  if(!entry.urls.length)
    throw new TypeError();
  return entry.urls[entry.urls.length - 1];
}

// TODO: should normalization just be appended as another url to the chain,
// so that normalization is treated like a step similar to redirect/rewrite?
function add_entry_url(entry, url_str) {
  if(!entry.urls)
    entry.urls = [];
  const norm = normalize_entry_url(url_str);
  if(entry.urls.includes(norm))
    return false;
  entry.urls.push(norm);
  return true;
}


// NOTE: hash cannot be removed because it sometimes identifies different
// urls because some sites use hash like a search param
// NOTE: this throws if url is invalid
function normalize_entry_url(url_str) {
  const url_obj = new URL(url_str);
  return url_obj.href;
}

// Returns a new entry object where fields have been sanitized. Impure
// TODO: ensure dates are not in the future, and not too old? Should this be
// a separate function like validate_entry
function sanitize_entry(input_entry) {
  const author_max_len = 200;
  const title_max_len = 1000;
  const content_max_len = 50000;
  const output_entry = Object.assign({}, input_entry);

  if(output_entry.author) {
    let author = output_entry.author;
    author = filter_control_chars(author);
    author = replace_tags(author, '');
    author = condense_whitespace(author);
    author = truncate_html(author, author_max_len);
    output_entry.author = author;
  }

  // Condensing node whitespace is handled separately
  // TODO: filter out non-printable characters other than \r\n\t
  if(output_entry.content) {
    let content = output_entry.content;
    content = truncate_html(content, content_max_len);
    output_entry.content = content;
  }

  if(output_entry.title) {
    let title = output_entry.title;
    title = filter_control_chars(title);
    title = replace_tags(title, '');
    title = condense_whitespace(title);
    title = truncate_html(title, title_max_len);
    output_entry.title = title;
  }

  return output_entry;
}


function db_delete_feed(tx, id, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Deleting feed', id);
    const store = tx.objectStore('feed');
    const request = store.delete(id);
    request.onsuccess = function(event) {
      resolve();
    };
    request.onerror = function(event) {
      reject(event.target.error);
    }
  });
}

function db_get_entry_ids_for_feed(tx, id, log) {
  return new Promise(function(resolve, reject) {
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(id);
    request.onsuccess = function onsuccess(event) {
      const ids = event.target.result;
      log.debug('Loaded %d entry ids with feed id', ids.length, id);
      resolve(ids);
    };
    request.onerror = function onerror(event) {
      reject(event.target.error);
    };
  });
}

// @param tx {IDBTransaction}
// @param id {int}
// @param chan {BroadcastChannel}
// @param log {console}
function db_delete_entry(tx, id, chan, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Deleting entry with id', id);
    const store = tx.objectStore('entry');
    const request = store.delete(id);
    request.onsuccess = function onsuccess(event) {
      log.debug('Deleted entry with id', id);
      chan.postMessage({'type': 'delete_entry_request', 'id': entry.id});
      resolve();
    };
    request.onsuccess = function onerror(event) {
      reject(event.target.error);
    };
  });
}

// TODO: deprecate in favor of put, and after moving sanitization and
// default props out, maybe make a helper function in pollfeeds that does this
function db_add_entry(conn, entry, log) {
  return new Promise(function(resolve, reject) {
    if('id' in entry) {
      reject(new TypeError());
      return;
    }

    log.log('Adding entry', get_entry_url(entry));
    const sanitized = sanitize_entry(entry);
    const storable = filter_empty_props(sanitized);
    storable.readState = ENTRY_UNREAD;
    storable.archiveState = ENTRY_UNARCHIVED;
    storable.dateCreated = new Date();
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.add(storable);
    request.onsuccess = function(event) {
      log.debug('Stored entry', get_entry_url(storable));
      resolve(event);
    };
    request.onerror = function(event) {
      log.error(event.target.error);
      reject(event.target.error);
    };
  });
}

function db_add_feed(log, conn, feed) {
  return new Promise(function db_add_feed_impl(resolve, reject) {
    if('id' in feed) {
      reject(new TypeError());
      return;
    }

    log.log('Adding feed', get_feed_url(feed));
    let storable = sanitize_feed(feed);
    storable.dateCreated = new Date();
    storable = filter_empty_props(storable);
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.add(storable);
    request.onsuccess = function db_add_feed_onsuccess(event) {
      storable.id = event.target.result;
      log.debug('Added feed %s with new id %s', get_feed_url(storable),
        storable.id);
      resolve(storable);
    };
    request.onerror = function db_add_feed_onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

// TODO: normalize feed url?
function db_contains_feed_url(conn, url, log) {
  return new Promise(function db_contains_feed_url_impl(resolve, reject) {
    log.debug('Checking for feed with url', url);
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.get(url);
    request.onsuccess = function db_contains_feed_url_onsuccess(event) {
      resolve(!!event.target.result);
    };
    request.onerror = function db_contains_feed_url_onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

function db_find_feed_by_id(conn, id, log = SilentConsole) {
  return new Promise(function db_find_feed_by_id_impl(resolve, reject) {
    log.debug('Finding feed by id', id);
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(id);
    request.onsuccess = function db_find_feed_by_id_onsuccess(event) {
      const feed = event.target.result;
      log.debug('Find result', feed);
      resolve(feed);
    };
    request.onerror = function db_find_feed_by_id_onerror(event) {
      reject(event.target.error);
    };
  });
}

// @param conn {IDBDatabase}
// @param urls {Array<String>} valid normalized entry urls
function db_contains_entry(conn, urls, log) {
  if(!urls || !urls.length)
    throw new TypeError();

  return new Promise(function contains_impl(resolve, reject) {
    const keys = [];
    const tx = conn.transaction('entry');
    tx.oncomplete = function tx_oncomplete(event) {
      resolve(keys.length ? true : false);
    };
    tx.onabort = function tx_onabort(event) {
      reject(event.target.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('urls');
    for(let url of urls) {
      const request = index.getKey(url);
      request.onsuccess = get_key_onsuccess;
    }

    function get_key_onsuccess(event) {
      const key = event.target.result;
      if(key)
        keys.push(key);
    }
  });
}

function db_put_feed(conn, feed, log) {
  return new Promise(function db_put_feed_impl(resolve, reject) {
    log.debug('Storing feed %s in database %s', get_feed_url(feed), conn.name);
    feed.dateUpdated = new Date();
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = function db_put_feed_onsuccess(event) {
      log.debug('Successfully put feed', get_feed_url(feed));
      if(!('id' in feed)) {
        log.debug('New feed id', event.target.result);
        feed.id = event.target.result;
      }
      // TODO: no need to pass back feed?
      resolve(feed);
    };
    request.onerror = function db_put_feed_onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

// TODO: use native getAll
function db_get_all_feeds(conn, log = SilentConsole) {
  return new Promise(function db_get_all_feeds_impl(resolve, reject) {
    log.log('Opening cursor over feed store');
    const feeds = [];
    const tx = conn.transaction('feed');
    tx.oncomplete = function db_get_all_feeds_txcomplete(event) {
      log.log('Loaded %s feeds', feeds.length);
      resolve(feeds);
    };
    const store = tx.objectStore('feed');
    const request = store.openCursor();
    request.onsuccess = function db_get_all_feeds_onsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        feeds.push(cursor.value);
        cursor.continue();
      }
    };
    request.onerror = function db_get_all_feeds_onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

function db_count_unread_entries(conn, log = SilentConsole) {
  return new Promise(function count_impl(resolve, reject) {
    log.debug('Counting unread entries');
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_UNREAD);
    request.onsuccess = function onsuccess(event) {
      log.debug('Counted %d unread entries', event.target.result);
      resolve(event.target.result);
    };
    request.onerror = function onerror(event) {
      log.error(event.target.error);
      reject(event.target.error);
    };
  });
}

function db_get_unarchived_read_entries(tx, log) {
  return new Promise(function(resolve, reject) {
    log.debug('Getting all unarchived read entries in database', tx.db.name);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const key_path = [ENTRY_UNARCHIVED, ENTRY_READ];
    const request = index.getAll(key_path);
    request.onsuccess = function onsuccess(event) {
      resolve(event.target.result);
    };
    request.onerror = function onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

// TODO: use getAll, passing in a count parameter as an upper limit, and
// then using slice or unshift or something to advance.
function db_get_unarchived_unread_entries(conn, offset, limit,
  log = SilentConsole) {
  return new Promise(function db_get_unarchived_unread_entries_impl(resolve,
    reject) {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const tx = conn.transaction('entry');
    tx.oncomplete = function(event) {
      resolve(entries);
    };
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_UNARCHIVED, ENTRY_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function onsuccess(event) {
      const cursor = event.target.result;
      if(!cursor)
        return;
      if(offset && !advanced) {
        advanced = true;
        log.debug('Advancing cursor by', offset);
        cursor.advance(offset);
        return;
      }
      entries.push(cursor.value);
      if(limit > 0 && ++counter < limit)
        cursor.continue();
    };
    request.onerror = function onerror(event) {
      reject(event.target.error);
    };
  });
}

// TODO: is this really a db function, or something higher level. It clearly
// doesn't belong right in the ui, but it is somewhere in between
function db_mark_entry_read(conn, id, log = SilentConsole) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError(`Invalid entry id ${id}`);

  return new Promise(async function mark_impl(resolve, reject) {
    log.debug('Marking entry %s as read', id);
    // Use one transaction for both the get and the put
    const tx = conn.transaction('entry', 'readwrite');

    // Get the corresponding entry object
    let entry;
    try {
      entry = await db_find_entry_by_id(tx, id, log);
    } catch(error) {
      reject(error);
      return;
    }

    // Attempting to mark a non-existant entry is an error
    if(!entry) {
      reject(new Error(`No entry found with id ${id}`));
      return;
    }

    // If the entry was already read, then the reasoning about the state of
    // the system is wrong, so consider this an error
    if(entry.readState === ENTRY_READ) {
      reject(new Error(`Already read entry with id ${id}`));
      return;
    }

    // Mutate the loaded entry object
    entry.readState = ENTRY_READ;
    entry.dateRead = new Date();

    try {
      await db_put_entry(tx, entry, log);

      // TODO: maybe this should just send an entry updated message to
      // a db channel, have badge_update_text react to messages
      await badge_update_text(conn, log);
      resolve();
    } catch(error) {
      reject(error);
    }
  });
}

// Resolves when the entry has been stored to the result of the request
// If entry.id is not set this will result in adding
// Sets dateUpdated before put. Impure.
// @param tx {IDBTransaction} the tx should include entry store and be rw
function db_put_entry(tx, entry, log = SilentConsole) {
  return new Promise(function put_impl(resolve, reject) {
    log.debug('Putting entry with id', entry.id);
    entry.dateUpdated = new Date();
    const request = tx.objectStore('entry').put(entry);
    request.onsuccess = function onsuccess(event) {
      log.debug('Put entry with id', entry.id);
      resolve(event.target.result);
    };
    request.onerror = function onerror(event) {
      log.debug(event.target.error);
      reject(event.target.error);
    };
  });
}

// Resolves with an entry object, or undefined if no entry was found.
// Rejects when an error occurred.
function db_find_entry_by_id(tx, id, log = SilentConsole) {
  return new Promise(function find_impl(resolve, reject) {
    log.debug('Finding entry by id', id);
    const store = tx.objectStore('entry');
    const request = store.get(id);
    request.onsuccess = function onsuccess(event) {
      const entry = event.target.result;
      if(entry)
        log.debug('Found entry %s with id', get_entry_url(entry), id);
      resolve(entry);
    };
    request.onerror = function onerror(event) {
      reject(event.target.error);
    };
  });
}
