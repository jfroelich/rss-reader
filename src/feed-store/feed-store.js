import FaviconLookup from "/src/favicon/lookup.js";
import * as Entry from "/src/feed-store/entry.js";
import * as FeedStoreErrors from "/src/feed-store/errors.js";
import * as Feed from "/src/feed-store/feed.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import assert from "/src/utils/assert.js";
import isUncheckedError from "/src/utils/is-unchecked-error.js";
import filterEmptyProps from "/src/utils/filter-empty-props.js";
import replaceTags from "/src/utils/html/replace-tags.js";
import htmlTruncate from "/src/utils/html/truncate.js";
import * as IndexedDbUtils from "/src/utils/indexeddb-utils.js";
import * as PromiseUtils from "/src/utils/promise-utils.js";
import sizeof from "/src/utils/sizeof.js";
import formatString from "/src/utils/format-string.js";
import * as StringUtils from "/src/utils/string-utils.js";
import * as URLStringUtils from "/src/utils/url-string-utils.js";

const DEBUG = false;
const dprintf = DEBUG ? console.debug : function(){};

export default function FeedStore() {
  // Default open parameters. Caller can optionally override prior to calling open
  this.name = 'reader';
  this.version = 24;
  this.openTimeoutMs = 500;

  // @private - use open to set, close to unset, rather than setting directly
  // @type {IDBDatabase} database connection handle
  this.conn;
}

// Opens a connection to the reader database
FeedStore.prototype.open = async function() {
  // Prohibit calling open unless conn is unset, implying it is closed, so that the prior
  // connection is not left hanging around
  assert(typeof this.conn === 'undefined' || this.conn === null);
  this.conn = await IndexedDbUtils.open(this.name, this.version, onUpgradeNeeded,
    this.openTimeoutMs);
};

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
function onUpgradeNeeded(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feedStore, entryStore;
  const stores = conn.objectStoreNames;

  console.log('upgrading database %s to version %s from version', conn.name, conn.version,
    event.oldVersion);

  if(event.oldVersion < 20) {
    feedStore = conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
    entryStore = conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});
    feedStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});

    entryStore.createIndex('readState', 'readState');
    entryStore.createIndex('feed', 'feed');
    entryStore.createIndex('archiveState-readState', ['archiveState', 'readState']);
    entryStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  } else {
    feedStore = tx.objectStore('feed');
    entryStore = tx.objectStore('entry');
  }

  if(event.oldVersion < 21) {
    // Add magic to all older entries
    addEntryMagic(tx);
  }

  if(event.oldVersion < 22) {
    addFeedMagic(tx);
  }

  if(event.oldVersion < 23) {
    // Delete the title index in feed store. It is no longer in use. Because it is no longer
    // created, and the db could be at any prior version, ensure that it exists before calling
    // deleteIndex to avoid the FeedStoreErrors.NotFoundError deleteIndex throws when deleting a non-existent index.

    // @type {DOMStringList}
    const indices = feedStore.indexNames;
    if(indices.contains('title')) {
      console.debug('deleting title index of feed store as part of upgrade');
      feedStore.deleteIndex('title');
    } else {
      console.debug('no title index found to delete during upgrade past version 22');
    }
  }

  if(event.oldVersion < 24) {
    // Version 24 adds an 'active' field to feeds. All existing feeds do not have an active
    // field. So all existing feeds must be modified to have an active property that is default
    // to true. It defaults to true because prior to this change, all feeds were presumed active.
    addActiveFieldToFeeds(feedStore);
  }
}

// Expects the transaction to be writable (either readwrite or versionchange)
function addEntryMagic(tx) {
  console.debug('Adding entry magic');
  const store = tx.objectStore('entry');
  const getAllEntriesRequest = store.getAll();
  getAllEntriesRequest.onerror = function(event) {
    console.warn('Error adding entry magic', getAllEntriesRequest.error);
  };
  getAllEntriesRequest.onsuccess = function(event) {
    const entries = event.target.result;
    writeEntriesWithMagic(store, entries);
  };
}

function writeEntriesWithMagic(entryStore, entries) {
  for(const entry of entries) {
    entry.magic = Entry.ENTRY_MAGIC;
    entry.dateUpdated = new Date();
    entryStore.put(entry);
  }
}

function addFeedMagic(tx) {
  console.debug('Adding feed magic');
  const store = tx.objectStore('feed');
  const getAllFeedsRequest = store.getAll();
  getAllFeedsRequest.onerror = function(event) {
    console.warn('Error adding feed magic', getAllFeedsRequest.error);
  };
  getAllFeedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for(const feed of feeds) {
      feed.magic = Feed.FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

function addActiveFieldToFeeds(feedStore) {
  console.debug('Adding active property to feeds');
  const feedsRequest = feedStore.getAll();
  feedsRequest.onerror = function(event) {
    console.warn('Database error getting all feeds', feedsRequest.error);
  };

  feedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for(const feed of feeds) {
      console.debug('Marking feed %d as active as part of upgrade', feed.id);
      feed.active = true;
      feed.dateUpdated = new Date();
      feedStore.put(feed);
    }
  };
}

FeedStore.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FeedStore.prototype.close = function() {
  IndexedDbUtils.close(this.conn);
  // The conn property must be unset to allow for calling open again without triggering an assert
  // Undefine rather than delete to maintain v8 hidden shape
  this.conn = void this.conn;
};

FeedStore.prototype.activateFeed = async function(feedId) {
  assert(this.isOpen());
  assert(Feed.isValidId(feedId));

  const feed = await this.findFeedById(feedId);
  assert(Feed.isFeed(feed));
  dprintf('Found feed to activate', feed.id);
  if(feed.active === true) {
    dprintf('Feed with id %d is already active', feed.id);
    return false;
  }

  feed.active = true;
  // Here we do not care about maintaining object shape, and furthermore, want to reduce object
  // size, so delete is preferred over setting to undefined.
  delete feed.deactivationReasonText;
  delete feed.deactivationDate;
  feed.dateUpdated = new Date();
  await this.putFeed(feed);
  return true;
};

// @param channel {BroadcastChannel} optional, notify observers of new entries
// @return {Number} the id of the added entry
FeedStore.prototype.addEntry = async function(entry, channel) {
  assert(Entry.isEntry(entry));
  assert(this.isOpen());
  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  const newEntryId = await this.putEntry(storable);
  if(channel) {
    // TODO: the message format should be defined externally
    const message = {type: 'entry-added', id: newEntryId};
    channel.postMessage(message);
  }

  return newEntryId;
};


// Returns a new entry object where fields have been sanitized. Impure
// TODO: now that filterUnprintableCharacters is a thing, I want to also filter such
// characters from input strings like author/title/etc. However it overlaps with the
// call to StringUtils.filterControls here. There is some redundant work going on. Also, in a sense,
// StringUtils.filterControls is now inaccurate. What I want is one function that strips binary
// characters except important ones, and then a second function that replaces or removes
// certain important binary characters (e.g. remove line breaks from author string).
// Something like 'replaceFormattingCharacters'.
function sanitizeEntry(inputEntry, authorMaxLength, titleMaxLength, contextMaxLength) {
  assert(Entry.isEntry(inputEntry));

  if(typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }

  if(typeof contextMaxLength === 'undefined') {
    contextMaxLength = 50000;
  }

  assert(Number.isInteger(authorMaxLength) && authorMaxLength >= 0);
  assert(Number.isInteger(titleMaxLength) && titleMaxLength >= 0);
  assert(Number.isInteger(contextMaxLength) && contentMaxLength >= 0);

  const blankEntry = Entry.createEntry();
  const outputEntry = Object.assign(blankEntry, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = StringUtils.filterControls(author);
    author = replaceTags(author, '');
    author = StringUtils.condenseWhitespace(author);
    author = htmlTruncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = StringUtils.filterUnprintableCharacters(content);
    content = htmlTruncate(content, contextMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = StringUtils.filterControls(title);
    title = replaceTags(title, '');
    title = StringUtils.condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

// Returns a promise that resolves to a count of unread entries in the database
// Throws an unchecked error if the database is closed or invalid.
// Throws a checked error if a database error occurs.
FeedStore.prototype.countUnreadEntries = function() {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

FeedStore.prototype.deactivateFeed = async function(feedId, reason) {
  assert(this.isOpen());
  assert(Feed.isValidId(feedId));
  const feed = await this.findFeedById(feedId);
  assert(Feed.isFeed(feed));

  if(feed.active === false) {
    dprintf('Tried to deactivate inactive feed', feed.id);
    return false;
  }

  feed.active = false;
  if(typeof reason === 'string') {
    feed.deactivationReasonText = reason;
  }
  const currentDate = new Date();
  feed.deactivationDate = currentDate;
  feed.dateUpdated = currentDate;
  await store.putFeed(feed);
  return true;
};

// TODO: if performance eventually becomes a material concern this should probably interact
// directly with the database
FeedStore.prototype.findActiveFeeds = async function() {
  assert(this.isOpen());
  const feeds = await this.getAllFeeds();
  return feeds.filter(isActiveFeed);
};

function isActiveFeed(feed) {
  // Explicitly test whether the active property is defined and of boolean type. This is just
  // an extra sanity check in case the property gets clobbered somewhere. But rather than a full
  // on assert I do not handle the error explicitly and consider the feed as inactive. What this
  // means is that if I ever see no feeds being loaded but I know they exist, this is probably
  // the reason.
  return feed.active === true;
}

FeedStore.prototype.findEntries = function(predicate, limit) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(typeof predicate === 'function');
    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(Number.isInteger(limit) && limit >= 0);
      assert(limit > 0);
    }

    const entries = [];
    const tx = this.conn.transaction('entry');
    tx.onerror = function(event) {
      reject(tx.error);
    };
    tx.oncomplete = function(event) {
      resolve(entries);
    };

    const store = tx.objectStore('entry');
    const request = store.openCursor();
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(cursor) {
        const entry = cursor.value;
        if(predicate(entry)) {
          entries.push(entry);
          if(limited && entries.length === limit) {
            return;
          }
        }
        cursor.continue();
      }
    };
  });
};

// Searches for and returns an entry object matching the id
// @param entryId {Number} id of entry to find
// @returns {Promise} a promise that resolves to an entry object, or undefined if no matching entry
// was found
FeedStore.prototype.findEntryById = function(entryId) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Entry.isValidId(entryId));
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(entryId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Returns an entry id matching url
// @param url {URL}
FeedStore.prototype.findEntryIdByURL = function(url) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(url instanceof URL);
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Returns true if the feed store contains an entry with the given url
FeedStore.prototype.containsEntryWithURL = async function(url) {
  assert(url instanceof URL);
  const id = await this.findEntryIdByURL(url);
  return Entry.isValidId(id);
};

// Returns a promise that resolves to an array of entry ids that are associated with the given
// feed id. Throws an unchecked error if the connection is invalid or not open, or if the feed id
// is invalid. Throws a checked error if a database error occurs.
// @param feedId {Number} the id of a feed in the database
// @return {Promise}
FeedStore.prototype.findEntryIdsByFeedId = function(feedId) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Feed.isValidId(feedId));
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Searches the feed store in the database for a feed corresponding to the given id. Returns a
// promise that resolves to the matching feed. Returns a promise that resolves to undefined if
// no matching feed is found. Throws an unchecked error if the database is closed or the id is
// not a valid feed id. Throws a checked error if there is a problem running the query.
// @param id {Number} a feed id
// @return {Promise}
FeedStore.prototype.findFeedById = function(feedId) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Feed.isValidId(feedId));
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Returns feed id if a feed with the given url exists in the database
// TODO: accept URL instead of string, change assert to instanceof URL
// @param urlString {String}
// @return {Promise}
FeedStore.prototype.findFeedIdByURL = function(urlString) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(URLStringUtils.isValidURLString(urlString));
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

FeedStore.prototype.containsFeedWithURL = async function(url) {
  assert(url instanceof URL);
  const id = this.findFeedIdByURL(url.href);
  return Feed.isValidId(id);
};

// Loads entries from the database that are for viewing
// Specifically these are entries that are unread, and not archived
// TODO: look into using getAll again
FeedStore.prototype.findViewableEntries = function(offset, limit) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = this.conn.transaction('entry');
    tx.oncomplete = function txOnComplete(event) {
      resolve(entries);
    };
    tx.onerror = function txOnError(event) {
      reject(tx.error);
    };

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function requestOnsuccess(event) {
      const cursor = event.target.result;
      if(cursor) {
        if(offset && !advanced) {
          advanced = true;
          cursor.advance(offset);
        } else {
          entries.push(cursor.value);
          if(limited && ++counter < limit) {
            cursor.continue();
          }
        }
      }
    };
  });
};

// Returns a promise that resolves to an array of feed ids, or rejects with a database error
FeedStore.prototype.getAllFeedIds = function() {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Load all feeds from the database
// Returns a promise that resolves to an array of feed objects
FeedStore.prototype.getAllFeeds = function() {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

FeedStore.prototype.markEntryAsRead = async function(entryId) {
  assert(this.isOpen());
  assert(Entry.isValidId(entryId));

  const entry = await this.findEntryById(entryId);
  assert(Entry.isEntry(entry));

  if(entry.readState === Entry.STATE_READ) {
    const message = formatString('Entry %d already in read state', entryId);
    throw new FeedStoreErrors.InvalidStateError(message);
  }

  assert(Entry.hasURL(entry));
  const url = Entry.peekURL(entry);
  dprintf('Found entry to mark as read', entryId, url);
  entry.readState = Entry.STATE_READ;
  entry.dateRead = entry.dateUpdated;
  entry.dateUpdated = new Date();
  await this.putEntry(entry);
  dprintf('Marked entry as read', entryId, url);

  // TODO: This is bad, a circular dependency
  updateBadgeText();
};

FeedStore.prototype.putEntry = function(entry) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Entry.isEntry(entry));
    const tx = this.conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

// Returns a feed object suitable for use with putFeed
FeedStore.prototype.prepareFeed = function(feed) {
  assert(Feed.isFeed(feed));
  let prepped = sanitizeFeed(feed);
  prepped = filterEmptyProps(prepped);
  return prepped;
};

// Resolves with request.result. If put is an add this resolves with the auto-incremented id.
// This stores the object as is. The caller is responsible for properties like feed magic,
// feed id, feed active status, date updated, etc.
FeedStore.prototype.putFeed = function(feed) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Feed.isFeed(feed));
    const tx = this.conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  });
};

const DEFAULT_TITLE_MAX_LEN = 1024;
const DEFAULT_DESC_MAX_LEN = 1024 * 10;

// Returns a shallow copy of the input feed with sanitized properties
function sanitizeFeed(feed, titleMaxLength, descMaxLength) {
  assert(Feed.isFeed(feed));

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = DEFAULT_TITLE_MAX_LEN;
  } else {
    assert(Number.isInteger(titleMaxLength) && titleMaxLength >= 0);
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = DEFAULT_DESC_MAX_LEN;
  } else {
    assert(Number.isInteger(descMaxLength) && descMaxLength >= 0);
  }

  const outputFeed = Object.assign({}, feed);
  const tagReplacement = '';
  const suffix = '';

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = StringUtils.filterControls(title);
    title = replaceTags(title, tagReplacement);
    title = StringUtils.condenseWhitespace(title);
    title = htmlTruncate(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let desc = outputFeed.description;
    desc = StringUtils.filterControls(desc);
    desc = replaceTags(desc, tagReplacement);
    desc = StringUtils.condenseWhitespace(desc);
    desc = htmlTruncate(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}

// @param entryIds {Array} an array of entry ids
FeedStore.prototype.removeEntries = function(entryIds) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Array.isArray(entryIds));

    for(const id of entryIds) {
      assert(Entry.isValidId(id));
    }

    const tx = this.conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(const id of entryIds) {
      store.delete(id);
    }
  });
};

// TODO: this should not accept entryIds as parameter, it should find the entries as part of the
// transaction implicitly. Once that it done there is no need to assert against entryIds as
// valid entry ids.
FeedStore.prototype.removeFeed = function(feedId, entryIds) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(Feed.isValidId(feedId));
    assert(Array.isArray(entryIds));

    for(const id of entryIds) {
      assert(Entry.isValidId(id));
    }

    const tx = this.conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    feedStore.delete(feedId);

    const entryStore = tx.objectStore('entry');
    for(const id of entryIds) {
      entryStore.delete(id);
    }
  });
};

FeedStore.prototype.setup = async function() {
  try {
    await this.open();
  } finally {
    this.close();
  }
};


// Loads archivable entries from the database. An entry is archivable if it has not already been
// archived, and has been read, and matches the custom predicate function.
// This does two layers of filtering. It would preferably be one layer but a three property index
// involving a date gets complicated. Given the perf is not top priority this is acceptable for
// now. The first filter layer is at the indexedDB level, and the second is the in memory
// predicate. The first layer reduces the number of entries loaded by a large amount.
// TODO: rather than assert failure when limit is 0, resolve immediately with an empty array.
// Limit is optional
// TODO: I feel like there is not a need for the predicate function. This is pushing too much
// burden/responsibility to the caller. This should handle the expiration check that the caller
// is basically using the predicate for. Basically the caller should just pass in a date instead
// of a function
FeedStore.prototype.findArchivableEntries = function(predicate, limit) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(typeof predicate === 'function');

    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(Number.isInteger(limit) && limit >= 0);
      assert(limit > 0);
    }

    const entries = [];
    const tx = this.conn.transaction('entry');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entries);

    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;
      if(predicate(entry)) {
        entries.push(entry);
        if(limited && (entries.length >= limit)) {
          return;
        }
      }

      cursor.continue();
    };
  });
};

// Archives certain entries in the database
// @param store {FeedStore} storage database
// @param maxAgeMs {Number} how long before an entry is considered archivable (using date entry
// created), in milliseconds
FeedStore.prototype.archiveEntries = async function(maxAgeMs, limit) {
  assert(this.isOpen());
  if(typeof maxAgeMs === 'undefined') {
    const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
    maxAgeMs = TWO_DAYS_MS;
  }

  assert(Number.isInteger(maxAgeMs) && maxAgeMs >= 0);
  const currentDate = new Date();

  function isArchivable(entry) {
    const entryAgeMs = currentDate - entry.dateCreated;
    return entryAgeMs > maxAgeMs;
  }

  const entries = await this.findArchivableEntries(isArchivable, limit);
  if(!entries.length) {
    console.debug('no archivable entries found');
    return;
  }

  const CHANNEL_NAME = 'reader';
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const promises = [];
  for(const entry of entries) {
    promises.push(this.archiveEntry(entry, channel));
  }

  try {
    await Promise.all(promises);
  } finally {
    channel.close();
  }

  console.log('Compacted %s entries', entries.length);
};

FeedStore.prototype.archiveEntry = async function(entry, channel) {
  const beforeSize = sizeof(entry);
  const compacted = compactEntry(entry);
  compacted.dateUpdated = new Date();
  const afterSize = sizeof(compacted);
  console.debug('Compact entry changed approx size from %d to %d', beforeSize, afterSize);
  await this.putEntry(compacted);
  const message = {type: 'entry-archived', id: compacted.id};
  channel.postMessage(message);
  return compacted;
};

function compactEntry(entry) {
  const compactedEntry = Entry.createEntry();
  compactedEntry.dateCreated = entry.dateCreated;
  compactedEntry.dateRead = entry.dateRead;
  compactedEntry.feed = entry.feed;
  compactedEntry.id = entry.id;
  compactedEntry.readState = entry.readState;
  compactedEntry.urls = entry.urls;
  compactedEntry.archiveState = Entry.STATE_ARCHIVED;
  compactedEntry.dateArchived = new Date();
  return compactedEntry;
}

FeedStore.prototype.refreshFeedIcons = async function(iconCache) {
  assert(this.isOpen());
  assert(iconCache.isOpen());
  const feeds = await this.findActiveFeeds();
  const query = new FaviconLookup();
  query.cache = iconCache;
  const promises = [];
  for(const feed of feeds) {
    promises.push(this.refreshFeedIcon(feed, query));
  }
  await PromiseUtils.promiseEvery(promises);
};

FeedStore.prototype.refreshFeedIcon = async function(feed, query) {
  assert(Feed.isFeed(feed));
  assert(Feed.hasURL(feed));

  const url = Feed.createIconLookupURL(feed);
  let iconURL;
  try {
    iconURL = await query.lookup(url);
  } catch(error) {
    if(isUncheckedError(error)) {
      throw error;
    }
  }

  const prevIconURL = feed.faviconURLString;
  feed.dateUpdated = new Date();
  if(prevIconURL && iconURL && prevIconURL !== iconURL) {
    feed.faviconURLString = iconURL;
    await this.putFeed(feed);
  } else if(prevIconURL && iconURL && prevIconURL === iconURL) {
    // noop
  } else if(prevIconURL && !iconURL) {
    feed.faviconURLString = void prevIconURL;
    await this.putFeed(feed);
  } else if(!prevIconURL && !iconURL) {
    // noop
  } else if(!prevIconURL && iconURL) {
    feed.faviconURLString = iconURL;
    await this.putFeed(feed);
  } else {
    console.warn('Unexpected state in refresh feed icons');
  }
};

// Removes lost entries from the database. An entry is lost if it is missing a url.
// @param limit {Number} optional, if specified should be positive integer > 0, maximum number
// of entries to lost entries to load from database
FeedStore.prototype.removeLostEntries = async function(limit) {
  const entries = await this.findEntries(isLostEntry, limit);
  console.debug('Found %s lost entries', entries.length);
  if(entries.length === 0) {
    return;
  }

  const ids = entries.map(entry => entry.id);
  await this.removeEntries(ids);

  const CHANNEL_NAME = 'reader';
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
};

function isLostEntry(entry) {
  return !Entry.hasURL(entry);
}

// Removes entries not linked to a feed from the database
// @param store {FeedStore} an open FeedStore instance
// @param limit {Number}
FeedStore.prototype.removeOrphanedEntries = async function(limit) {
  const feedIds = await this.getAllFeedIds();

  function isOrphan(entry) {
    const id = entry.feed;
    return !Feed.isValidId(id) || !feedIds.includes(id);
  }

  const entries = await this.findEntries(isOrphan, limit);
  console.debug('Found %s orphans', entries.length);
  if(entries.length === 0) {
    return;
  }

  const orphanIds = entries.map(entry => entry.id);
  if(orphanIds.length < 1) {
    return;
  }

  await this.removeEntries(orphanIds);

  const CHANNEL_NAME = 'reader';
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();
};
