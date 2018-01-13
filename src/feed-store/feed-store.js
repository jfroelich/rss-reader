import * as IndexedDbUtils from "/src/common/indexeddb-utils.js";
import {replaceTags, truncateHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";
import {onUpgradeNeeded} from "/src/feed-store/upgrade.js";
import {
  filterControls,
  filterEmptyProps,
  filterUnprintableCharacters
} from "/src/feed-store/utils.js";


export default function FeedStore() {
  this.name = 'reader';
  this.version = 24;
  this.timeout = 500;

  // private IDBDatabase handle
  this.conn = null;
}

FeedStore.prototype.open = async function() {
  if(this.isOpen()) {
    console.error('Database already open');
    return Status.EINVALIDSTATE;
  }

  const [status, conn] = await IndexedDbUtils.open(this.name, this.version, onUpgradeNeeded,
    this.timeout);
  this.conn = conn;
  return status;
};


FeedStore.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FeedStore.prototype.close = function() {
  IndexedDbUtils.close(this.conn);
  // The conn property must be unset to allow for calling open again without error
  // Undefine rather than delete to maintain v8 hidden shape
  this.conn = void this.conn;
};

FeedStore.prototype.activateFeed = async function(feedId) {
  console.debug('Activating feed', feedId);

  if(!this.isOpen()) {
    console.error('FeedStore is not in open state to activate feed');
    return Status.EINVALIDSTATE;
  }

  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return Status.EINVAL;
  }

  let [status, feed] = await this.findFeedById(feedId);
  if(status !== Status.OK) {
    console.error('Could not find feed to activate', feedId);
    return status;
  }

  // TODO: reduce message size
  console.debug('Found feed to activate', feed);

  if(feed.active) {
    console.debug('Cannot activate feed %d that is already active', feed.id);
    return Status.EINVALIDSTATE;
  }

  // Transition feed properties from active to inactive state. Minizing storage size is preferred
  // over maintaining v8 object shape.
  feed.active = true;
  delete feed.deactivationReasonText;
  delete feed.deactivationDate;
  feed.dateUpdated = new Date();

  [status] = await this.putFeed(feed);
  if(status !== Status.OK) {
    console.error('Failed to put feed with status', status);
    return status;
  }

  return Status.OK;
};

// @param channel {BroadcastChannel} optional, notify observers of new entries
// @return {Number} the id of the added entry
FeedStore.prototype.addEntry = async function(entry, channel) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!Entry.isEntry(entry)) {
    console.error('Invalid entry', entry);
    return [Status.EINVAL];
  }

  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  let [status, newEntryId] = await this.putEntry(storable);
  if(status !== Status.OK) {
    console.error('Failed to put entry with status', status);
    return status;
  }

  if(channel) {
    // TODO: the message format should be defined externally?
    const message = {type: 'entry-added', id: newEntryId};
    channel.postMessage(message);
  }

  return [Status.OK, newEntryId];
};


// Returns a new entry object where fields have been sanitized. Impure
// TODO: now that filterUnprintableCharacters is a thing, I want to also filter such
// characters from input strings like author/title/etc. However it overlaps with the
// call to filterControls here. There is some redundant work going on. Also, in a sense,
// filterControls is now inaccurate. What I want is one function that strips binary
// characters except important ones, and then a second function that replaces or removes
// certain important binary characters (e.g. remove line breaks from author string).
// Something like 'replaceFormattingCharacters'.
function sanitizeEntry(inputEntry, authorMaxLength, titleMaxLength, contentMaxLength) {

  if(typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }

  if(typeof contentMaxLength === 'undefined') {
    contentMaxLength = 50000;
  }

  const blankEntry = Entry.createEntry();
  const outputEntry = Object.assign(blankEntry, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControls(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = truncateHTML(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = filterUnprintableCharacters(content);
    content = truncateHTML(content, contentMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControls(title);
    title = replaceTags(title, '');
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Returns a promise that resolves to a count of unread entries in the database
// Throws an unchecked error if the database is closed or invalid.
// Throws a checked error if a database error occurs.
FeedStore.prototype.countUnreadEntries = async function() {
  if(!this.isOpen()) {
    return [Status.EINVALIDSTATE];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let count;
  try {
    count = await promise;
  } catch(error) {
    return [Status.EDB];
  }

  return [Status.OK, count];
};

FeedStore.prototype.markEntryRead = async function(entryId) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  if(!Entry.isValidId(entryId)) {
    console.error('Invalid entry id', entryId);
    return Status.EINVAL;
  }

  let [status, entry] = await this.findEntryById(entryId);
  if(status !== Status.OK) {
    console.error('Failed to find entry by id with status', status);
    return status;
  }

  console.debug('Loaded entry to mark as read', entryId, entry.urls);

  if(entry.readState === Entry.STATE_READ) {
    console.error('Entry %d already in read state', entryId);
    return Status.EINVALIDSTATE;
  }

  entry.readState = Entry.STATE_READ;
  entry.dateRead = entry.dateUpdated;
  entry.dateUpdated = new Date();

  [status] = await this.putEntry(entry);
  if(status !== Status.OK) {
    console.error('Failed to put entry with status', status);
    return status;
  }

  console.debug('Successfully put read entry in database', entryId);
  return Status.OK;
};

FeedStore.prototype.deactivateFeed = async function(feedId, reason) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return Status.EINVAL;
  }

  let [status, feed] = await this.findFeedById(feedId);
  if(status !== Status.OK) {
    console.error('Could not find feed by id', feedId);
    return status;
  }

  if(!feed.active) {
    console.error('Tried to deactivate inactive feed', feed.id);
    return Status.EINVALIDSTATE;
  }

  feed.active = false;
  if(typeof reason === 'string') {
    feed.deactivationReasonText = reason;
  }
  const currentDate = new Date();
  feed.deactivationDate = currentDate;
  feed.dateUpdated = currentDate;

  [status] = await store.putFeed(feed);
  if(status !== Status.OK) {
    console.error('Failed to put feed with status', status);
    return status;
  }

  return Status.OK;
};


FeedStore.prototype.findActiveFeeds = async function() {
  if(!this.isOpen()) {
    return [Status.EINVALIDSTATE];
  }

  // TODO: if performance eventually becomes a material concern this should probably interact
  // directly with the database and query by index
  let [status, feeds] = await this.getAllFeeds();
  if(status !== Status.OK) {
    console.error('Failed to get all feeds with status', status);
    return status;
  }

  const activeFeeds = feeds.filter((feed) => feed.active);
  return [Status.OK, activeFeeds];
};

FeedStore.prototype.findEntries = async function(predicate, limit) {
  if(!this.isOpen()) {
    console.error('Database not open');
    return [Status.EINVALIDSTATE];
  }

  if(typeof predicate !== 'function') {
    console.error('Argument predicate not a function');
    return [Status.EINVAL];
  }

  const limited = typeof limit !== 'undefined';
  if(limited) {
    if(!Number.isInteger(limit) || limit < 0) {
      console.error('Express limit not a positive integer');
      return [Status.EINVAL];
    }
  }

  const promise = new Promise((resolve, reject) => {
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

  let entries;
  try {
    entries = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entries];
};

// Searches for and returns an entry object matching the id
// @param entryId {Number} id of entry to find
// @returns {Promise} a promise that resolves to an entry object, or undefined if no matching entry
// was found
FeedStore.prototype.findEntryById = async function(entryId) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!Entry.isValidId(entryId)) {
    console.error('Invalid entry id', entryId);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(entryId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let entry;
  try {
    entry = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  // TODO: use a clearer error code?
  if(!Entry.isEntry(entry)) {
    console.error('Malformed entry object loaded from database', entry);
    return [Status.EDB];
  }

  return [Status.OK, entry];
};

// Returns an entry id matching url
// @param url {URL}
FeedStore.prototype.findEntryIdByURL = async function(url) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!(url instanceof URL)) {
    console.error('url parameter not a URL', url);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let entryId;
  try {
    entryId = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entryId];
};

FeedStore.prototype.containsEntryWithURL = async function(url) {
  if(!(url instanceof URL)) {
    return [Status.EINVAL];
  }

  const [status, id] = await this.findEntryIdByURL(url);
  if(status !== Status.OK) {
    return [status];
  }

  const valid = Entry.isValidId(id);
  return [Status.OK, valid];
};

// TODO: left off factoring status here

// Returns a promise that resolves to an array of entry ids that are associated with the given
// feed id. Throws an unchecked error if the connection is invalid or not open, or if the feed id
// is invalid. Throws a checked error if a database error occurs.
// @param feedId {Number} the id of a feed in the database
// @return {Promise}
FeedStore.prototype.findEntryIdsByFeedId = async function(feedId) {

  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.getAllKeys(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let entryIds;
  try {
    entryIds = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entryIds];
};

// Searches the feed store in the database for a feed corresponding to the given id. Returns a
// promise that resolves to the matching feed. Returns a promise that resolves to undefined if
// no matching feed is found. Throws an unchecked error if the database is closed or the id is
// not a valid feed id. Throws a checked error if there is a problem running the query.
// @param id {Number} a feed id
// @return {Promise}
FeedStore.prototype.findFeedById = async function(feedId) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let feed;
  try {
    feed = await promise;
  } catch(error) {
    return [Status.EDB];
  }

  // TODO: use a more accurate and narrow error?
  if(!Feed.isFeed(feed)) {
    return [Status.EDB];
  }

  return [Status.OK, feed];
};

// Returns feed id if a feed with the given url exists in the database
// @param url {URL}
// @return {Promise}
FeedStore.prototype.findFeedIdByURL = async function(url) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!(url instanceof URL)) {
    console.error('Invalid url type', url);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let feedId;
  try {
    feedId = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, feedId];
};

FeedStore.prototype.containsFeedWithURL = async function(url) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!(url instanceof URL)) {
    return [Status.EINVAL];
  }

  const [status, id] = await this.findFeedIdByURL(url);
  if(status !== Status.OK) {
    return [status];
  }

  return [Status.OK, Feed.isValidId(id)];
};

// Loads entries from the database that are for viewing
// Specifically these are entries that are unread, and not archived
// TODO: look into using getAll again
FeedStore.prototype.findViewableEntries = async function(offset, limit) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  const promise = new Promise((resolve, reject) => {
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

  let entries;
  try {
    entries = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entries];
};

// Returns a promise that resolves to an array of feed ids, or rejects with a database error
FeedStore.prototype.getAllFeedIds = async function() {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  try {
    const feedIds = await getAllFeedIdsPromise(this.conn);
    return [Status.OK, feedIds];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
};

function getAllFeedIdsPromise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}


// TODO: rename, 'All' is implied
// Load all feeds from the database
// Returns a promise that resolves to an array of feed objects
FeedStore.prototype.getAllFeeds = async function() {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let feeds;
  try {
    feeds = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, feeds];
};

FeedStore.prototype.putEntry = async function(entry) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!Entry.isEntry(entry)) {
    console.error('Invalid entry', entry);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  let entryId;
  try {
    entryId = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entryId];
};

// Returns a feed object suitable for use with putFeed
FeedStore.prototype.prepareFeed = function(feed) {
  let prepped = sanitizeFeed(feed);
  prepped = filterEmptyProps(prepped);
  return prepped;
};

// Resolves with request.result. If put is an add this resolves with the auto-incremented id.
// This stores the object as is. The caller is responsible for properties like feed magic,
// feed id, feed active status, date updated, etc.
FeedStore.prototype.putFeed = async function(feed) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(!Feed.isFeed(feed)) {
    console.error('Invalid feed', feed);
    return [Status.EINVAL];
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  });

  let feedId;
  try {
    feedId = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, feedId];
};

const DEFAULT_TITLE_MAX_LEN = 1024;
const DEFAULT_DESC_MAX_LEN = 1024 * 10;

// Returns a shallow copy of the input feed with sanitized properties
function sanitizeFeed(feed, titleMaxLength, descMaxLength) {

  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = DEFAULT_TITLE_MAX_LEN;
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = DEFAULT_DESC_MAX_LEN;
  }

  const outputFeed = Object.assign({}, feed);
  const tagReplacement = '';
  const suffix = '';

  if(outputFeed.title) {
    let title = outputFeed.title;
    title = filterControls(title);
    title = replaceTags(title, tagReplacement);
    title = condenseWhitespace(title);
    title = truncateHTML(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if(outputFeed.description) {
    let desc = outputFeed.description;
    desc = filterControls(desc);
    desc = replaceTags(desc, tagReplacement);
    desc = condenseWhitespace(desc);
    desc = truncateHTML(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}

// @param entryIds {Array} an array of entry ids
FeedStore.prototype.removeEntries = async function(entryIds) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  if(!Array.isArray(entryIds)) {
    console.error('entryIds is not an array', entryIds);
    return Status.EINVAL;
  }

  for(const id of entryIds) {
    if(!Entry.isValidId(id)) {
      console.debug('Invalid entry id', id);
      return Status.EINVAL;
    }
  }

  if(!entryIds.length) {
    console.debug('No entries to remove');
    return Status.OK;
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(const id of entryIds) {
      console.debug('Removing entry with id', id);
      store.delete(id);
    }
  });

  try {
    await promise;
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  return Status.OK;
};

// TODO: this should not accept entryIds as parameter, it should find the entries as part of the
// transaction implicitly. Once that it done there is no need to assert against entryIds as
// valid entry ids.
FeedStore.prototype.removeFeed = async function(feedId, entryIds) {
  if(!this.isOpen()) {
    console.error('Database is not open');
    return Status.EINVALIDSTATE;
  }

  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return Status.EINVAL;
  }

  if(!Array.isArray(entryIds)) {
    console.error('Invalid entryIds parameter', entryIds);
    return Status.EINVAL;
  }

  // If any id is invalid the whole operation fails
  for(const id of entryIds) {
    if(!Entry.isValidId(id)) {
      console.error('Invalid entry id', id);
      return Status.EINVAL;
    }
  }

  const promise = new Promise((resolve, reject) => {
    const tx = this.conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    console.debug('Deleting feed with id', feedId);
    feedStore.delete(feedId);

    const entryStore = tx.objectStore('entry');
    for(const id of entryIds) {
      console.debug('Deleting entry with id', id);
      entryStore.delete(id);
    }
  });

  try {
    await promise;
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  return Status.OK;
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
FeedStore.prototype.findArchivableEntries = async function(predicate, limit) {

  if(!this.isOpen()) {
    console.error('Database is not open');
    return [Status.EINVALIDSTATE];
  }

  if(typeof predicate !== 'function') {
    console.error('Invalid predicate argument', predicate);
    return [Status.EINVAL];
  }

  const limited = typeof limit !== 'undefined';
  if(limited) {
    if(!Number.isInteger(limit) || limit < 0) {
      console.error('Invalid express limit argument', limit);
      return [Status.EINVAL];
    }
  }

  // TODO: if IDBIndex.prototype.getAll supports limit, I should use that

  const promise = new Promise((resolve, reject) => {
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

  let entries;
  try {
    entries = await promise;
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }

  return [Status.OK, entries];
};


// Removes lost entries from the database. An entry is lost if it is missing a url.
// @param limit {Number} optional, if specified should be positive integer > 0, maximum number
// of entries to lost entries to load from database
FeedStore.prototype.removeLostEntries = async function(limit) {
  let [status, entries] = await this.findEntries(isLostEntry, limit);
  if(status !== Status.OK) {
    console.error('Failed to find entries with status ', status);
    return status;
  }

  console.debug('Found %d lost entries', entries.length);
  if(entries.length === 0) {
    return Status.OK;
  }

  const ids = entries.map(entry => entry.id);

  status = await this.removeEntries(ids);
  if(status !== Status.OK) {
    console.error('Failed to remove entries with status ', status);
    return status;
  }

  const CHANNEL_NAME = 'reader';
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return Status.OK;
};

function isLostEntry(entry) {
  return !Entry.hasURL(entry);
}

// Removes entries not linked to a feed from the database
// @param store {FeedStore} an open FeedStore instance
// @param limit {Number}
FeedStore.prototype.removeOrphanedEntries = async function(limit) {
  let status;
  let feedIds;
  let entries;

  [status, feedIds] = await this.getAllFeedIds();
  if(status !== Status.OK) {
    console.error('Failed to get feed ids with status', status);
    return status;
  }

  function isOrphan(entry) {
    const id = entry.feed;
    return !Feed.isValidId(id) || !feedIds.includes(id);
  }

  [status, entries] = await this.findEntries(isOrphan, limit);
  if(status !== Status.OK) {
    console.error('Failed to find entries with status', status);
    return status;
  }

  console.debug('Found %s orphans', entries.length);
  if(entries.length === 0) {
    return Status.OK;
  }

  const orphanIds = entries.map(entry => entry.id);
  status = await this.removeEntries(orphanIds);
  if(status !== Status.OK) {
    console.error('Failed to remove entries with status', status);
    return status;
  }

  const CHANNEL_NAME = 'reader';
  const channel = new BroadcastChannel(CHANNEL_NAME);
  const message = {type: 'entry-deleted', id: undefined, reason: 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return Status.OK;
};
