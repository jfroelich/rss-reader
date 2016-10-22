// See license.md

'use strict';

// TODO: merge feed-db.js
// TODO: add/update feed should delegate to put feed
// TODO: maybe merge add/put entry into one function
// TODO: maybe entry states should be in a single property instead of
// two props, like UNREAD_UNARCHIVED
// TODO: fix issue with normalizing entry urls
// https://hack.ether.camp/idea/path redirects to
// https://hack.ether.camp/#/idea/path which normalizes to
// https://hack.ether.camp/. Stripping hash screws this up.
// TODO: for entry urls with path containing '//', replace with '/'
// e.g. http://us.battle.net//hearthstone/en/blog/20303037
// TODO: remove the defined title requirement, have options manually sort feeds
// instead of using the title index, deprecate the title index, stop ensuring
// title is an empty string

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

const ENTRY_UNREAD = 0;
const ENTRY_READ = 1;
const ENTRY_UNARCHIVED = 0;
const ENTRY_ARCHIVED = 1;

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

// TODO: does this need to be public?
function normalize_entry_url(url_str) {
  const url_obj = new URL(url_str);
  url_obj.hash = '';
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

function db_add_entry(log, conn, entry, callback) {
  if('id' in entry)
    throw new TypeError();
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
    callback(event);
  };
  request.onerror = function(event) {
    log.error(event.target.error);
    callback(event);
  };
}

function db_add_feed(log, conn, feed, callback) {
  if('id' in feed)
    throw new TypeError();
  log.log('Adding feed', get_feed_url(feed));
  let storable = sanitize_feed(feed);
  storable.dateCreated = new Date();
  storable = filter_empty_props(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = function(event) {
    storable.id = event.target.result;
    log.debug('Added feed %s with new id %s', get_feed_url(storable),
      storable.id);
    callback({'type': 'success', 'feed': storable});
  };
  request.onerror = function(event) {
    log.error(event.target.error);
    callback({'type': 'error'});
  };
}

// TODO: normalize feed url?
function db_contains_feed_url(log, conn, url, callback) {
  log.debug('Checking for feed with url', url);
  let didFindFeed = false;
  const tx = conn.transaction('feed');
  const store = tx.objectStore('feed');
  const index = store.index('urls');
  const request = index.get(url);
  request.onsuccess = function(event) {
    const feed = event.target.result;
    didFindFeed = !!feed;
    log.debug('Found feed with url %s? %s', url, didFindFeed);
    callback(didFindFeed);
  };
  request.onerror = function(event) {
    log.debug(event.target.error);
    callback(didFindFeed);
  };
}

// Assumes urls are normalized
function db_find_entry(log, conn, urls, limit, callback) {
  if(!urls.length)
    throw new TypeError();
  log.log('Find entry', urls);
  const matches = [];
  let reached_limit = false;

  const tx = conn.transaction('entry');
  tx.oncomplete = function(event) {
    log.log('Found %d entries for %o', matches.length, urls);
    callback(matches);
  };
  const store = tx.objectStore('entry');
  const index = store.index('urls');

  // Iterate in reverse to increase the chance of an earlier exit
  // TODO: this only would matter if we search the urls sequentially, but
  // we currently search concurrently, so maybe this is stupid
  for(let i = urls.length - 1; i > -1; i--) {
    const request = index.openCursor(urls[i]);
    request.onsuccess = on_success;
    request.onerror = log.error;
  }

  // TODO: avoid pushing dups?
  // TODO: >= or > ?
  function on_success(event) {
    const cursor = event.target.result;
    if(cursor && !reached_limit) {
      matches.push(cursor.value);
      reached_limit = limit && matches.length >= limit;
      if(!reached_limit)
        cursor.continue();
    }
  }
}

function db_put_feed(log, conn, feed, callback) {
  log.debug('Putting feed', get_feed_url(feed));
  feed.dateUpdated = new Date();
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = function(event) {
    log.debug('Successfully put feed', get_feed_url(feed));
    if(!('id' in feed)) {
      log.debug('New feed id', event.target.result);
      feed.id = event.target.result;
    }
    // TODO: no need to pass back feed
    if(callback)
      callback('success', feed);
  };
  request.onerror = function(event) {
    log.debug(event.target.error);
    if(callback)
      callback('error');
  };
  return tx;
}

function db_update_feed(log, conn, feed, callback) {
  if(!('id' in feed))
    throw new TypeError();
  log.log('Updating feed', get_feed_url(feed));
  let storable = sanitize_feed(feed);
  storable.dateUpdated = new Date();
  storable = filter_empty_props(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = function(event) {
    log.debug('Updated feed', get_feed_url(storable));
    if(callback)
      callback({'type': 'success', 'feed': storable});
  };
  request.onerror = function(event) {
    log.error(event.target.error);
    if(callback)
      callback({'type': 'error', 'feed': storable});
  };
}

function db_get_all_feeds(log, conn, callback) {
  log.log('Opening cursor over feed store');
  const feeds = [];
  const tx = conn.transaction('feed');
  tx.oncomplete = function(event) {
    log.log('Loaded %s feeds', feeds.length);
    callback(feeds);
  };
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    }
  };
  request.onerror = log.error;
}

function db_count_unread_entries(log, conn, callback) {
  log.debug('Counting unread entries');
  const tx = conn.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(ENTRY_UNREAD);
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
  request.onerror = function(event) {
    log.error(event.target.error);
    callback(-1);// 0 would be ambiguous
  };
}

function db_mark_entry_read(log, id, callback) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError();
  log.debug('Marking entry %s as read', id);
  const db = new FeedDb(log);
  db.connect(connect_on_success, connect_on_error);

  function connect_on_success(conn) {
    log.debug('Connected to database', conn.name);
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.openCursor(id);
    request.onsuccess = open_cursor_on_success;
    request.onerror = open_cursor_on_error;
  }

  function connect_on_error(event) {
    on_complete(event, 'ConnectionError');
  }

  function open_cursor_on_success(event) {
    const cursor = event.target.result;
    if(!cursor) {
      log.error('No entry found with id', id);
      on_complete(event, 'NotFoundError');
      return;
    }

    const entry = cursor.value;
    log.debug('Found entry', get_entry_url(entry));
    if(entry.readState === ENTRY_READ) {
      log.error('Already read entry with id', entry.id);
      on_complete(event, 'AlreadyReadError');
      return;
    }

    log.debug('Updating entry', entry.id);
    entry.readState = ENTRY_READ;
    const current_date = new Date();
    entry.dateRead = current_date;
    entry.dateUpdated = current_date;
    cursor.update(entry);
    const conn = event.target.transaction.db;
    update_badge(conn, log);
    on_complete(event, 'Success');
  }

  function open_cursor_on_error(event) {
    log.error(event.target.error);
    on_complete(event, 'CursorError');
  }

  function on_complete(event, type) {
    log.log('Completed marking entry %s as read', id);
    const conn = event.target.transaction.db;
    if(conn) {
      log.debug('Closing connection to database', conn.name);
      conn.close();
    }
    if(callback)
      callback(type);
  }
}
