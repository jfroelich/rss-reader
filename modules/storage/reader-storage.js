// See license.md

'use strict';

// TODO: add/update feed should delegate to put feed
// TODO: maybe merge add/put entry into one function
// TODO: maybe entry states should be in a single property instead of
// two props, like UNREAD_UNARCHIVED
// TODO: remove the defined feed title requirement, have options manually sort
// feeds instead of using the title index, deprecate the title index, stop
// ensuring title is an empty string. note: i partly did some of this

// Wraps an opened IDBDatabase instance to provide storage related functions
class ReaderStorage {

  constructor(log = SilentConsole) {
    this.log = log;
  }

  get name() {
    return this.conn.name;
  }

  // Request the database connection to eventually close
  disconnect() {
    if(this.conn) {
      this.log.debug('Closing connection to database', this.conn.name);
      this.conn.close();
    } else {
      console.warn('this.conn is undefined');
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
      store.log.log('Connecting to database', name, 'version',version);
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

    if(feed_indices.contains('schemeless'))
      feed_store.deleteIndex('schemeless');
    if(feed_indices.contains('url'))
      feed_store.deleteIndex('url');

    if(!feed_indices.contains('urls'))
      feed_store.createIndex('urls', 'urls', {
        'multiEntry': true,
        'unique': true
      });

    if(!feed_indices.contains('title'))
      feed_store.createIndex('title', 'title');
    if(entry_indices.contains('unread'))
      entry_store.deleteIndex('unread');
    if(!entry_indices.contains('readState'))
      entry_store.createIndex('readState', 'readState');
    if(!entry_indices.contains('feed'))
      entry_store.createIndex('feed', 'feed');
    if(!entry_indices.contains('archiveState-readState'))
      entry_store.createIndex('archiveState-readState',
        ['archiveState', 'readState']);
    if(entry_indices.contains('link'))
      entry_store.deleteIndex('link');
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
      const sanitized = Entry.sanitize(entry);
      const storable = filter_empty_props(sanitized);
      storable.readState = Entry.UNREAD;
      storable.archiveState = Entry.UNARCHIVED;
      storable.dateCreated = new Date();
      const tx = this.conn.transaction('entry', 'readwrite');
      const store = tx.objectStore('entry');
      const request = store.add(storable);
      request.onsuccess = (event) => {
        this.log.debug('Stored entry', Entry.getURL(storable));
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
      this.log.log('Adding feed', Feed.getURL(feed));
      let storable = Feed.sanitize(feed);
      storable = filter_empty_props(storable);
      storable.dateCreated = new Date();
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.add(storable);
      request.onsuccess = (event) => {
        storable.id = event.target.result;
        this.log.debug('Added feed %s with new id %s', Feed.getURL(storable),
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

  // Resolves with a boolean indicating whether an entry with the given url
  // was found in storage
  // @param url {String}
  containsEntryURL(url) {
    return new Promise((resolve, reject) => {
      if(typeof url !== 'string')
        return reject(new TypeError('invalid url argument'));
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('urls');
      const request = index.getKey(url);
      request.onsuccess = () => resolve(!!request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Adds or overwrites a feed in storage. Resolves with the stored feed. If
  // adding then the generated id is set on the input feed object.
  // @param feed {Object}
  putFeed(feed) {
    return new Promise((resolve, reject) => {
      this.log.debug('Storing feed %s', Feed.getURL(feed));
      feed.dateUpdated = new Date();
      const tx = this.conn.transaction('feed', 'readwrite');
      const store = tx.objectStore('feed');
      const request = store.put(feed);
      request.onsuccess = (event) => {
        this.log.debug('Successfully put feed', Feed.getURL(feed));
        if(!('id' in feed)) {
          this.log.debug('New feed id', event.target.result);
          feed.id = event.target.result;
        }
        resolve(feed);
      };
      request.onerror = (event) => reject(event.target.error);
    });
  }

  // Resolves with an array of all feeds in storage
  getFeeds() {
    return new Promise((resolve, reject) => {
      const tx = this.conn.transaction('feed');
      const store = tx.objectStore('feed');
      const request = store.getAll();
      request.onsuccess = () => {
        this.log.debug('Loaded %d feeds from database', request.result.length);
        resolve(request.result);
      }
      request.onerror = () => reject(request.error);
    });
  }

  countUnreadEntries() {
    return new Promise((resolve, reject) => {
      this.log.debug('Counting unread entries');
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('readState');
      const request = index.count(Entry.UNREAD);
      request.onsuccess = (event) => {
        this.log.debug('Counted %d unread entries', request.result);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  getUnarchivedReadEntries() {
    return new Promise((resolve, reject) => {
      this.log.debug('Getting unarchived read entries');
      const tx = this.conn.transaction('entry');
      const store = tx.objectStore('entry');
      const index = store.index('archiveState-readState');
      const key_path = [Entry.UNARCHIVED, Entry.READ];
      const request = index.getAll(key_path);
      request.onsuccess = () => resolve(request.result);
      request.onerror = (event) => {
        this.log.debug(event.target.error);
        reject(event.target.error);
      };
    });
  }

  // Promise.all is failfast so this aborts if any one entry fails
  // TODO: is there really a need to use a shared transaction?
  async putAllEntries(entries) {
    this.log.debug('Putting %d entries', entries.length);
    const tx = this.conn.transaction('entry', 'readwrite');
    const proms = entries.map((entry) => this.putEntry(tx, entry));
    return await Promise.all(proms);
  }

  // TODO: use getAll, passing in a count parameter as an upper limit, and
  // then using slice or unshift or something to advance.
  // TODO: internally the parameter to getAll might be (offset+limit)
  getUnarchivedUnreadEntries(offset, limit) {
    return new Promise((resolve, reject) => {
      const entries = [];
      let counter = 0;
      let advanced = false;
      const tx = this.conn.transaction('entry');
      tx.oncomplete = (event) => resolve(entries);
      const store = tx.objectStore('entry');
      const index = store.index('archiveState-readState');
      const keyPath = [Entry.UNARCHIVED, Entry.UNREAD];
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
          this.log.debug('Found entry %s with id', Entry.getURL(entry), id);
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
