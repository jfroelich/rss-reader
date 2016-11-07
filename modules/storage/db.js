// See license.md

'use strict';

// TODO: add/update feed should delegate to put feed
// TODO: maybe merge add/put entry into one function
// TODO: maybe entry states should be in a single property instead of
// two props, like UNREAD_UNARCHIVED
// TODO: remove the defined feed title requirement, have options manually sort
// feeds instead of using the title index, deprecate the title index, stop
// ensuring title is an empty string. note: i partly did some of this
// TODO: mark as read belongs in controllers
// TODO: non-storage stuff like entry flags and such does not belong here

// Wraps an opened IDBDatabase instance to provide storage related functions
class ReaderStorage {

  constructor(log = SilentConsole) {
    this.log = log;
  }

  // Get the database name
  get name() {
    return this.conn.name;
  }

  // Close the database connection
  disconnect() {
    if(this.conn) {
      this.log.debug('Closing database', this.conn.name);
      this.conn.close();
    } else {
      console.warn('conn is undefined');
    }
  }

  // Returns a promise that resolves to a new ReaderStorage instance with an
  // active connection. Use this factory method instead of the constructor
  static connect(log = SilentConsole, name = config.db_name,
    version = config.db_version) {
    return new Promise((resolve, reject) => {
      if(!name.length)
        throw new TypeError('name is an empty string');
      const store = new ReaderStorage(log);
      store.log.log('Connecting to database', name);
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = store._onupgradeneeded;
      request.onsuccess = function onsuccess(event) {
        store.conn = event.target.result;
        store.log.log('Connected to database', store.name);
        resolve(store);
      };
      request.onerror = (event) => reject(event.target.error);
      request.onblocked = (event) =>
        store.log.log('Waiting on blocked connection...');
    });
  }

  // TODO: revert upgrade to using a version migration approach
  _onupgradeneeded(event) {
    const conn = event.target.result;
    const tx = event.target.transaction;
    let feed_store = null, entry_store = null;
    const stores = conn.objectStoreNames;

    console.dir(event);
    this.log.log('Upgrading database %s to version %s from version', conn.name,
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

    if(!entry_indices.contains('urls')) {
      entry_store.createIndex('urls', 'urls', {
        'multiEntry': true,
        'unique': true
      });
    }
  }

  removeFeed(tx, id) {
    return new Promise((resolve, reject) => {
      this.log.debug('Deleting feed', id);
      const store = tx.objectStore('feed');
      const request = store.delete(id);
      request.onsuccess = (event) => {
        this.log.debug('Deleted feed with id', id);
        resolve();
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  getFeedEntryIds(tx, id) {
    return new Promise((resolve, reject) => {
      const store = tx.objectStore('entry');
      const index = store.index('feed');
      const request = index.getAllKeys(id);
      request.onsuccess = (event) => {
        const ids = event.target.result;
        this.log.debug('Loaded %d entry ids with feed id', ids.length, id);
        resolve(ids);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  //db_delete_entry
  // @param tx {IDBTransaction}
  // @param id {int}
  // @param chan {BroadcastChannel}
  // @param log {console}
  removeEntry(tx, id, chan) {
    return new Promise((resolve, reject) => {
      this.log.debug('Deleting entry', id);
      const store = tx.objectStore('entry');
      const request = store.delete(id);
      request.onsuccess = (event) => {
        this.log.debug('Deleted entry with id', id);
        chan.postMessage({'type': 'delete_entry_request', 'id': entry.id});
        resolve();
      };
      request.onsuccess = (event) => reject(event.target.error);
    });
  }

  // TODO: deprecate in favor of put, and after moving sanitization and
  // default props out, maybe make a helper function in pollfeeds that does this
  // TODO: ensure entries added by put, if not have id, have unread flag
  // and date created
  addEntry(entry) {
    return new Promise((resolve, reject) => {
      if('id' in entry)
        return reject(new TypeError());
      this.log.log('Adding entry with urls [%s]', entry.urls.join(', '));
      const sanitized = sanitize_entry(entry);
      const storable = filter_empty_props(sanitized);
      storable.readState = ENTRY_UNREAD;
      storable.archiveState = ENTRY_UNARCHIVED;
      storable.dateCreated = new Date();
      const tx = this.conn.transaction('entry', 'readwrite');
      const store = tx.objectStore('entry');
      const request = store.add(storable);
      request.onsuccess = (event) => {
        this.log.debug('Stored entry', get_entry_url(storable));
        resolve(event);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // TODO: move obj prep to caller, use put logic, rename to putFeed
  addFeed(feed) {
    return new Promise((resolve, reject) => {
      if('id' in feed)
        return reject(new TypeError());
      this.log.log('Adding feed', get_feed_url(feed));
      let storable = sanitize_feed(feed);
      storable = filter_empty_props(storable);
      storable.dateCreated = new Date();
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.add(storable);
      request.onsuccess = (event) => {
        storable.id = event.target.result;
        this.log.debug('Added feed %s with new id %s', get_feed_url(storable),
          storable.id);
        resolve(storable);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // @param url {String}
  containsFeedURL(url) {
    return new Promise((resolve, reject) => {
      this.log.debug('Checking for feed with url', url);
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const index = store.index('urls');
      const request = index.getKey(url);
      request.onsuccess = (event) => resolve(!!event.target.result);
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // @param id {Number} feed id, positive integer
  findFeedById(id) {
    return new Promise((resolve, reject) => {
      if(!Number.isInteger(id) || id < 1)
        return reject(new TypeError('invalid feed id ' + id));
      this.log.debug('Finding feed by id', id);
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.get(id);
      request.onsuccess = (event) => {
        const feed = event.target.result;
        this.log.debug('Find result', feed);
        resolve(feed);
      };
      request.onerror = () => reject(request.error);
    });
  }

  // TODO: deprecate, use individual searches for a single url, and
  // let caller race if they want. note i think in poll there is no need to
  // do this all at once
  // @param conn {IDBDatabase}
  // @param urls {Array<String>} valid normalized entry urls
  containsAnyEntryURLs(urls) {
    return new Promise((resolve, reject) => {
      if(!urls || !urls.length)
        return reject(new TypeError('invalid urls argument'));
      const keys = [];
      const tx = this.conn.transaction('entry');
      tx.oncomplete = () => resolve(keys.length ? true : false);
      tx.onabort = (event) => reject(event.target.error);
      const store = tx.objectStore('entry');
      const index = store.index('urls');
      for(let url of urls) {
        const request = index.getKey(url);
        request.onsuccess = onsuccess;
      }

      function onsuccess(event) {
        const key = event.target.result;
        if(key)
          keys.push(key);
      }
    });
  }

  putFeed(feed) {
    return new Promise((resolve, reject) => {
      this.log.debug('Storing feed %s', get_feed_url(feed));
      feed.dateUpdated = new Date();
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);
      request.onsuccess = (event) => {
        this.log.debug('Successfully put feed', get_feed_url(feed));
        if(!('id' in feed)) {
          this.log.debug('New feed id', event.target.result);
          feed.id = event.target.result;
        }
        resolve(feed);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // TODO: use native getAll
  getFeeds() {
    return new Promise((resolve, reject) => {
      this.log.log('Opening cursor over feed store');
      const feeds = [];
      const tx = this.conn.transaction('feed');
      tx.oncomplete = (event) => {
        this.log.log('Loaded %s feeds', feeds.length);
        resolve(feeds);
      };
      const store = tx.objectStore('feed');
      const request = store.openCursor();
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if(cursor) {
          feeds.push(cursor.value);
          cursor.continue();
        }
      };
      request.onerror = (event) => {
        this.log.debug(event.target.error);
        reject(event.target.error);
      };
    });
  }

  countUnreadEntries() {
    return new Promise((resolve, reject) => {
      this.log.debug('Counting unread entries');
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('readState');
      const request = index.count(ENTRY_UNREAD);
      request.onsuccess = (event) => {
        this.log.debug('Counted %d unread entries', request.result);
        resolve(request.result);
      };
      request.onerror = (event) => {
        this.log.error(event.target.error);
        reject(event.target.error);
      };
    });
  }

  getUnarchivedReadEntries(tx) {
    return new Promise((resolve, reject) => {
      this.log.debug('Getting unarchived read entries');
      const store = tx.objectStore('entry');
      const index = store.index('archiveState-readState');
      const key_path = [ENTRY_UNARCHIVED, ENTRY_READ];
      const request = index.getAll(key_path);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => {
        this.log.debug(event.target.error);
        reject(event.target.error);
      };
    });
  }

  // TODO: use getAll, passing in a count parameter as an upper limit, and
  // then using slice or unshift or something to advance.
  getUnarchivedUnreadEntries(offset, limit) {
    return new Promise((resolve, reject) => {
      const entries = [];
      let counter = 0;
      let advanced = false;
      const tx = this.conn.transaction('entry');
      tx.oncomplete = (event) => resolve(entries);
      const store = tx.objectStore('entry');
      const index = store.index('archiveState-readState');
      const keyPath = [ENTRY_UNARCHIVED, ENTRY_UNREAD];
      const request = index.openCursor(keyPath);
      request.onsuccess = (event) => {
        const cursor = event.target.result;
        if(!cursor)
          return;
        if(offset && !advanced) {
          advanced = true;
          this.log.debug('Advancing cursor by', offset);
          cursor.advance(offset);
          return;
        }
        entries.push(cursor.value);
        if(limit > 0 && ++counter < limit)
          cursor.continue();
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  //db_put_entry
  // Resolves when the entry has been stored to the result of the request
  // If entry.id is not set this will result in adding
  // Sets dateUpdated before put. Impure.
  // @param tx {IDBTransaction} the tx should include entry store and be rw
  putEntry(tx, entry) {
    return new Promise((resolve, reject) => {
      this.log.debug('Putting entry with id', entry.id);
      entry.dateUpdated = new Date();
      const request = tx.objectStore('entry').put(entry);
      request.onsuccess = (event) => {
        this.log.debug('Put entry with id', entry.id);
        resolve(event.target.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  //db_find_entry_by_id
  // Resolves with an entry object, or undefined if no entry was found.
  // Rejects when an error occurred.
  findEntryById(tx, id) {
    return new Promise((resolve, reject) => {
      this.log.debug('Finding entry by id', id);
      const store = tx.objectStore('entry');
      const request = store.get(id);
      request.onsuccess = (event) => {
        const entry = event.target.result;
        if(entry)
          this.log.debug('Found entry %s with id', get_entry_url(entry), id);
        resolve(entry);
      };
      request.onerror = () => reject(request.error);
    });
  }

  static removeDatabase(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// TODO: move to controllers
async function db_mark_entry_read(store, id, log = SilentConsole) {
  if(!Number.isInteger(id) || id < 1)
    throw new TypeError(`Invalid entry id ${id}`);
  log.debug('Marking entry %s as read', id);
  const tx = store.conn.transaction('entry', 'readwrite');
  const entry = await store.findEntryById(tx, id);
  if(!entry)
    throw new Error(`No entry found with id ${id}`);
  if(entry.readState === ENTRY_READ)
    throw new Error(`Already read entry with id ${id}`);
  entry.readState = ENTRY_READ;
  entry.dateRead = new Date();
  await store.putEntry(tx, entry);
  await badge_update_text(store, log);
}

const ENTRY_UNREAD = 0;
const ENTRY_READ = 1;
const ENTRY_UNARCHIVED = 0;
const ENTRY_ARCHIVED = 1;



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
  const url = new URL(url_str);
  return url.href;
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

function add_entry_url(entry, url_str) {
  if(!entry.urls)
    entry.urls = [];
  const normalized_url = new URL(url_str);
  if(entry.urls.includes(normalized_url.href))
    return false;
  entry.urls.push(normalized_url.href);
  return true;
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
