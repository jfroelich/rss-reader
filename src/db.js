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

function db_connect(name = config.db_name, version = config.db_version,
  log = SilentConsole) {

  function db_connect_impl(resolve, reject) {
    log.log('Connecting to database', name, version);
    const request = indexedDB.open(name, version);
    request.onupgradeneeded = db_upgrade.bind(request, log);
    request.onsuccess = function db_connect_onsuccess(event) {
      const conn = event.target.result;
      log.debug('Connected to database', conn.name);
      resolve(conn);
    };
    request.onerror = function db_connect_on_error(event) {
      reject(event.target.error);
    };
    request.onblocked = db_connect_onblocked;
  }

  function db_connect_onblocked(event) {
    log.debug('connection blocked, waiting indefinitely');
  }

  return new Promise(db_connect_impl);

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
  return new Promise(function db_delete_impl(resolve, reject) {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = function db_delete_onsuccess(event) {
      resolve();
    };
    request.onerror = function db_delete_onerror(event) {
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
  url_obj.hash = '';
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

function normalize_entry_url(url_str) {
  const url_obj = new URL(url_str);
  url_obj.hash = '';

  // Fix a common error case
  if(url_obj.pathname.startsWith('//'))
    url_obj.pathname = url_obj.pathname.substring(1);

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

function db_add_entry(log, conn, entry) {
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
// TODO: move log to last arg
function db_contains_feed_url(log, conn, url) {
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
  return new Promise(function contains_impl(resolve, reject) {
    // This is an actual error because it should never happen
    if(!urls || !urls.length) {
      reject(new TypeError());
      return;
    }
    let did_resolve = false;
    const tx = conn.transaction('entry');

    // TODO: this may have a built in timeout that I can skip if I track
    // num urls processed myself, let the last onsuccess handler to meet the
    // num processed === urls.length condition to do the final resolve
    // or maybe better, use a promise for each request that accepts the same
    // tx, then use await Promise.all on the promises? But I still do not
    // short-circuit in the manner I want? But maybe that doesn't matter
    // because I am not shortcircuiting now anyway

    tx.oncomplete = function tx_oncomplete(event) {
      if(!did_resolve)
        resolve(false);
    };

    const store = tx.objectStore('entry');
    const index = store.index('urls');
    for(let url of urls) {
      const request = index.openKeyCursor(url);
      request.onsuccess = open_key_cursor_onsuccess;
    }

    function open_key_cursor_onsuccess(event) {
      if(did_resolve)
        return;
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }

      // TODO: would tx.abort cancel the other requests without an exception?

      // if cursor is defined, then cursor.key is defined, but there is no need
      // to access it
      did_resolve = true;
      resolve(true);
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

// TODO: reverse argument order
function db_count_unread_entries(log = SilentConsole, conn) {
  return new Promise(function db_count_unread_entries_impl(resolve, reject) {
    log.debug('Counting unread entries');
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_UNREAD);
    request.onsuccess = function db_count_unread_entries_onsuccess(event) {
      log.debug('Counted %d unread entries', event.target.result);
      resolve(event.target.result);
    };
    request.onerror = function db_count_unread_entries_onerror(event) {
      log.error(event.target.error);
      reject(event.target.error);
    };
  });
}

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
    request.onsuccess = function db_get_unarchived_unread_entries_onsuccess(
      event) {
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
    request.onerror = function db_get_unarchived_unread_entries_onerror(event) {
      reject(event.target.error);
    };
  });
}


// TODO: convert to async, do not use bind
// TODO: require the caller to pass in conn now that it is easier to do with
// async
function db_mark_entry_read(id, log = SilentConsole) {
  return new Promise(db_mark_entry_read_impl.bind(undefined, id, log));
}

function db_mark_entry_read_impl(id, log, resolve, reject) {
  log.debug('Marking entry %s as read', id);
  if(!Number.isInteger(id) || id < 1) {
    reject(new TypeError());
    return;
  }

  db_connect(undefined, undefined, log).then(
    connect_on_success).catch(
      reject);

  function connect_on_success(conn) {
    log.debug('Connected to database', conn.name);
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.openCursor(id);
    request.onsuccess = open_cursor_on_success;
    request.onerror = open_cursor_on_error;
  }

  function open_cursor_on_success(event) {
    const cursor = event.target.result;
    const conn = event.target.transaction.db;
    if(!cursor) {
      log.error('No entry found with id', id);
      reject(new Error('No entry found'));
      conn.close();
      return;
    }

    const entry = cursor.value;
    log.debug('Found entry', get_entry_url(entry));
    if(entry.readState === ENTRY_READ) {
      log.error('Already read entry with id', entry.id);
      reject(new Error('Already read entry'));
      conn.close();
      return;
    }

    log.debug('Updating entry', entry.id);
    entry.readState = ENTRY_READ;
    const current_date = new Date();
    entry.dateRead = current_date;
    entry.dateUpdated = current_date;
    cursor.update(entry);
    update_badge(conn, log);
    conn.close();
    resolve();
  }

  function open_cursor_on_error(event) {
    log.error(event.target.error);
    reject(event.target.error);
  }
}
