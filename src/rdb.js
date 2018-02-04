import {html_replace_tags, html_truncate} from '/src/common/html-utils.js';
import {open as utilsOpen} from '/src/common/indexeddb-utils.js';

// TODO: do away with all auto-connecting. The solution to inconvenient resource
// lifetime management is through using wrapper functions, not through dynamic
// variables

// TODO: move this to github issue
// TODO: rename feed.dateUpdated and entry.dateUpdated to updatedDate for better
// consistency

// TODO: move this to github issue as a mental note
// TODO: consider grouping feed.active properties together

const FEED_MAGIC = 0xfeedfeed;
const ENTRY_MAGIC = 0xdeadbeef;

export const ENTRY_STATE_UNREAD = 0;
export const ENTRY_STATE_READ = 1;
export const ENTRY_STATE_UNARCHIVED = 0;
export const ENTRY_STATE_ARCHIVED = 1;

export function open(name = 'reader', version = 24, timeout = 500) {
  return utilsOpen(name, version, onUpgradeNeeded, timeout);
}

// Helper for open. Does the database upgrade. This should never be
// called directly. To do an upgrade, call open with a higher version number.
function onUpgradeNeeded(event) {
  const conn = event.target.result;
  const tx = event.target.transaction;
  let feedStore, entryStore;
  const stores = conn.objectStoreNames;

  console.log(
      'Upgrading database %s to version %s from version', conn.name,
      conn.version, event.oldVersion);

  if (event.oldVersion < 20) {
    feedStore =
        conn.createObjectStore('feed', {keyPath: 'id', autoIncrement: true});
    entryStore =
        conn.createObjectStore('entry', {keyPath: 'id', autoIncrement: true});
    feedStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});

    entryStore.createIndex('readState', 'readState');
    entryStore.createIndex('feed', 'feed');
    entryStore.createIndex(
        'archiveState-readState', ['archiveState', 'readState']);
    entryStore.createIndex('urls', 'urls', {multiEntry: true, unique: true});
  } else {
    feedStore = tx.objectStore('feed');
    entryStore = tx.objectStore('entry');
  }

  if (event.oldVersion < 21) {
    // Add magic to all older entries
    addEntryMagic(tx);
  }

  if (event.oldVersion < 22) {
    addFeedMagic(tx);
  }

  if (event.oldVersion < 23) {
    if (feedStore.indexNames.contains('title')) {
      feedStore.deleteIndex('title');
    }
  }

  if (event.oldVersion < 24) {
    addActiveFieldToFeeds(feedStore);
  }
}

// Expects the transaction to be writable (either readwrite or versionchange)
function addEntryMagic(tx) {
  console.debug('Adding entry magic');
  const store = tx.objectStore('entry');
  const getAllEntriesRequest = store.getAll();
  getAllEntriesRequest.onerror = function(event) {
    console.error(getAllEntriesRequest.error);
  };
  getAllEntriesRequest.onsuccess = function(event) {
    const entries = event.target.result;
    writeEntriesWithMagic(store, entries);
  };
}

function writeEntriesWithMagic(entryStore, entries) {
  for (const entry of entries) {
    entry.magic = ENTRY_MAGIC;
    entry.dateUpdated = new Date();
    entryStore.put(entry);
  }
}

function addFeedMagic(tx) {
  console.debug('Adding feed magic');
  const store = tx.objectStore('feed');
  const getAllFeedsRequest = store.getAll();
  getAllFeedsRequest.onerror = console.error;
  getAllFeedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.magic = FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

function addActiveFieldToFeeds(store) {
  const feedsRequest = store.getAll();
  feedsRequest.onerror = console.error;
  feedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for (const feed of feeds) {
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}

export async function reader_db_activate_feed(conn, channel, feedId) {
  assert(feed_is_valid_id(feedId), 'Invalid feed id', feedId);
  const dconn = conn ? conn : await open();
  await activateFeedPromise(dconn, feedId);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    channel.postMessage({type: 'feed-activated', id: feedId});
  }
}

function activateFeedPromise(conn, feedId) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => {
      const feed = request.result;
      assert(feed, 'Could not find feed', feedId);
      assert(!feed.active, 'Feed is already active ' + feedId);
      feed.active = true;
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

export async function reader_db_deactivate_feed(conn, channel, feedId, reasonText) {
  assert(feed_is_valid_id(feedId), 'Invalid feed id ' + feedId);
  const dconn = conn ? conn : await open();
  await deactivateFeedPromise(dconn, feedId, reasonText);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    channel.postMessage({type: 'feed-deactivated', id: feedId});
  }
}

function deactivateFeedPromise(conn, feedId, reasonText) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => {
      const feed = request.result;
      assert(feed, 'Could not find feed', feedId);
      assert(feed.active, 'Feed is inactive', feedId);
      feed.active = false;
      feed.deactivationDate = new Date();
      feed.deactivationReasonText = reasonText;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

// TODO: should validation be caller concern
// TODO: I wonder if sanitization is a concern for something earlier in the
// processing pipeline, and at this point, only validation is a concern, and
// no magical mutations should happen

export async function entry_store_add_entry(conn, channel, entry) {
  assert(entry_is_entry(entry), 'Invalid entry ' + entry);
  assert(!entry.id);
  validateEntry(entry);

  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  delete storable.dateUpdated;

  let nullChannel = null;
  const entryId = await putEntry(conn, nullChannel, storable);
  if (channel) {
    channel.postMessage({type: 'entry-added', id: entryId});
  }
  storable.id = entryId;
  return storable;
}

export async function countUnreadEntries(conn) {
  const dconn = conn ? conn : await open();
  const count = await countUnreadEntriesPromise(dconn);
  if (!conn) {
    dconn.close();
  }
  return count;
}

function countUnreadEntriesPromise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(ENTRY_STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function entry_mark_read(conn, channel, entryId) {
  assert(entry_is_valid_id(entryId));
  const dconn = conn ? conn : await open();
  await markEntryReadPromise(dconn, entryId);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    // channel may be closed by the time this executes when entry_mark_read is
    // not awaited, so trap the invalid state error and just log it
    try {
      channel.postMessage({type: 'entry-marked-read', id: entryId});
    } catch (error) {
      console.debug(error);
    }
  }
}

function markEntryReadPromise(conn, entryId) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    const request = store.get(entryId);
    request.onsuccess = () => {
      const entry = request.result;
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

export async function find_active_feeds(conn) {
  const feeds = await reader_db_get_feeds(conn);
  return feeds.filter(feed => feed.active);
}

// TODO: inline
async function findEntryIdByURL(conn, url) {
  const dconn = conn ? conn : await open();
  const entryId = await findEntryIdByURLPromise(dconn, url);
  if (!conn) {
    dconn.close();
  }
  return entryId;
}

function findEntryIdByURLPromise(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function entry_store_contains_entry_with_url(conn, url) {
  const entryId = await findEntryIdByURL(conn, url);
  return entry_is_valid_id(entryId);
}

export async function reader_db_find_feed_by_id(conn, feedId) {
  const dconn = conn ? conn : await open();
  const feed = await findFeedByIdPromise(dconn, feedId);
  if (!conn) {
    dconn.close();
  }
  return feed;
}

function findFeedByIdPromise(conn, feedId) {
  return new Promise((resolve, reject) => {
    assert(feed_is_valid_id(feedId));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: inline
async function findFeedIdByURL(conn, url) {
  const dconn = conn ? conn : await open();
  const feedId = await findFeedIdByURLPromise(dconn, url);
  if (!conn) {
    dconn.close();
  }
  return feedId;
}

function findFeedIdByURLPromise(conn, url) {
  return new Promise((resolve, reject) => {
    assert(url instanceof URL);
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function feed_store_contains_feed_with_url(conn, url) {
  const feedId = await findFeedIdByURL(conn, url);
  return feed_is_valid_id(feedId);
}

export async function reader_db_find_viewable_entries(conn, offset, limit) {
  const dconn = conn ? conn : await open();
  const entries = await findViewableEntriesPromise(dconn, offset, limit);
  if (!conn) {
    dconn.close();
  }
  return entries;
}

function findViewableEntriesPromise(conn, offset, limit) {
  return new Promise((resolve, reject) => {
    const entries = [];
    let counter = 0;
    let advanced = false;
    const limited = limit > 0;
    const tx = conn.transaction('entry');
    tx.oncomplete = () => resolve(entries);
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [ENTRY_STATE_UNARCHIVED, ENTRY_STATE_UNREAD];
    const request = index.openCursor(keyPath);
    request.onsuccess = function requestOnsuccess(event) {
      const cursor = event.target.result;
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

export async function reader_db_get_feeds(conn) {
  const dconn = conn ? conn : await open();
  const feeds = await getFeedsPromise(dconn);
  if (!conn) {
    dconn.close();
  }
  return feeds;
}

function getFeedsPromise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function putEntry(conn, channel, entry) {
  const dconn = conn ? conn : await open();
  const entryId = await putEntryPromise(dconn, entry);
  if (!conn) {
    dconn.close();
  }
  if (channel) {
    channel.postMessage({type: 'entry-updated', id: entryId});
  }
  return entryId;
}

function putEntryPromise(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(entry_is_entry(entry));
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function feed_prepare(feed) {
  return filterEmptyProps(sanitizeFeed(feed));
}

// TODO: validateFeed (here or in feed_store_feed_put)
export async function feed_store_add(conn, channel, feed) {
  const preparedFeed = feed_prepare(feed);
  preparedFeed.active = true;
  preparedFeed.dateCreated = new Date();
  delete preparedFeed.dateUpdated;
  const feedId = await feed_store_feed_put(conn, null, preparedFeed);
  preparedFeed.id = feedId;
  if (channel) {
    channel.postMessage({type: 'feed-added', id: feedId});
  }
  return preparedFeed;
}

export async function feed_store_feed_put(conn, channel, feed) {
  const dconn = conn ? conn : await open();
  const feedId = await putFeedPromise(dconn, feed);
  if (!conn) {
    dconn.close();
  }

  // Suppress invalid state error when channel is closed in non-awaited call
  // TODO: if awaited, I'd prefer to throw. How?
  if (channel) {
    try {
      channel.postMessage({type: 'feed-updated', id: feedId});
    } catch (error) {
      console.debug(error);
    }
  }

  return feedId;
}

function putFeedPromise(conn, feed) {
  return new Promise((resolve, reject) => {
    assert(feed_is_feed(feed));
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    // TODO: when updating, is put result still the feed id? I know
    // that result is feed id when adding, but what about updating? Review
    // the documentation on IDBObjectStore.prototype.put
    // So ... double check and warrant this resolves to an id
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function feed_store_remove_feed(
    conn, channel, feedId, reasonText) {
  const dconn = conn ? conn : await open();
  const entryIds = await removeFeedPromise(dconn, feedid);
  if (!conn) {
    dconn.close();
  }

  if (channel) {
    channel.postMessage({type: 'feed-deleted', id: feedId, reason: reasonText});
    for (const id of entryIds) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: reasonText});
    }
  }
}

function removeFeedPromise(conn, feedId) {
  return new Promise(function executor(resolve, reject) {
    assert(feed_is_valid_id(feedId));
    let entryIds;
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');
    tx.oncomplete = () => resolve(entryIds);
    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    console.debug('Deleting feed with id', feedId);
    feedStore.delete(feedId);

    // Get all entry ids for the feed and then delete them
    const entryStore = tx.objectStore('entry');
    const feedIndex = entryStore.index('feed');
    const request = feedIndex.getAllKeys(feedId);
    request.onsuccess = function(event) {
      entryIds = request.result;

      // Fire off all the requests concurrently without waiting for any one
      // to resolve. Eventually they all will resolve and the transaction
      // will complete and then the promise resolves.
      for (const id of entryIds) {
        console.debug('Deleting entry', id);
        entryStore.delete(id);
      }
    };
  });
}

// Returns a shallow copy of the input feed with sanitized properties
function sanitizeFeed(feed, titleMaxLength, descMaxLength) {
  if (typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1024;
  }

  if (typeof descMaxLength === 'undefined') {
    descMaxLength = 1024 * 10;
  }

  const blankFeed = feed_create();
  const outputFeed = Object.assign(blankFeed, feed);
  const tagReplacement = '';
  const suffix = '';

  if (outputFeed.title) {
    let title = outputFeed.title;
    title = filterControls(title);
    title = html_replace_tags(title, tagReplacement);
    title = condenseWhitespace(title);
    title = html_truncate(title, titleMaxLength, suffix);
    outputFeed.title = title;
  }

  if (outputFeed.description) {
    let desc = outputFeed.description;
    desc = filterControls(desc);
    desc = html_replace_tags(desc, tagReplacement);
    desc = condenseWhitespace(desc);
    desc = html_truncate(desc, descMaxLength, suffix);
    outputFeed.description = desc;
  }

  return outputFeed;
}

// Inspect the entry object and throw an error if any value is invalid
// or any required properties are missing
function validateEntry(entry) {
  // TODO: implement
  // By not throwing an error, this indicates the entry is valid
}

// Returns a new entry object where fields have been sanitized. Impure
// TODO: now that filterUnprintableCharacters is a thing, I want to also filter
// such characters from input strings like author/title/etc. However it overlaps
// with the call to filterControls here. There is some redundant work going on.
// Also, in a sense, filterControls is now inaccurate. What I want is one
// function that strips binary characters except important ones, and then a
// second function that replaces or removes certain important binary characters
// (e.g. remove line breaks from author string). Something like
// 'replaceFormattingCharacters'.
function sanitizeEntry(
    inputEntry, authorMaxLength, titleMaxLength, contentMaxLength) {
  if (typeof authorMaxLength === 'undefined') {
    authorMaxLength = 200;
  }

  if (typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1000;
  }

  if (typeof contentMaxLength === 'undefined') {
    contentMaxLength = 50000;
  }

  const blankEntry = entry_create();
  const outputEntry = Object.assign(blankEntry, inputEntry);

  if (outputEntry.author) {
    let author = outputEntry.author;
    author = filterControls(author);
    author = html_replace_tags(author, '');
    author = condenseWhitespace(author);
    author = html_truncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  if (outputEntry.content) {
    let content = outputEntry.content;
    content = filterUnprintableCharacters(content);
    content = html_truncate(content, contentMaxLength);
    outputEntry.content = content;
  }

  if (outputEntry.title) {
    let title = outputEntry.title;
    title = filterControls(title);
    title = html_replace_tags(title, '');
    title = condenseWhitespace(title);
    title = html_truncate(title, titleMaxLength);
    outputEntry.title = title;
  }

  return outputEntry;
}

function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

// Returns a new object that is a copy of the input less empty properties. A
// property is empty if it is null, undefined, or an empty string. Ignores
// prototype, deep objects, getters, etc. Shallow copy by reference.
function filterEmptyProps(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};
  let undef;
  if (typeof object === 'object' && object !== null) {
    for (const key in object) {
      if (hasOwnProp.call(object, key)) {
        const value = object[key];
        if (value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}

// If the input is a string then the function returns a new string that is
// approximately a copy of the input less certain 'unprintable' characters. In
// the case of bad input the input itself is returned. To test if characters
// were replaced, check if the output string length is less than the input
// string length.
function filterUnprintableCharacters(value) {
  // Basically this removes those characters in the range of [0..31] except for:
  // \t is \u0009 which is base10 9
  // \n is \u000a which is base10 10
  // \f is \u000c which is base10 12
  // \r is \u000d which is base10 13
  // TODO: look into how much this overlaps with filterControls

  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
  // The length check is done because given that replace will be a no-op when
  // the length is 0 it is faster to perform the length check than it is to call
  // replace. I do not know the distribution of inputs but I expect that empty
  // strings are not rare.
  return typeof value === 'string' && value.length ?
      value.replace(pattern, '') :
      value;
}

// Returns a new string where Unicode Cc-class characters have been removed.
// Throws an error if string is not a defined string. Adapted from these stack
// overflow questions: http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function filterControls(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

function assert(value, message) {
  if (!value) throw new Error(message || 'Assertion error');
}

export function feed_create() {
  return {magic: FEED_MAGIC};
}

// Return true if the value looks like a feed object
export function feed_is_feed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function feed_is_valid_id(id) {
  return Number.isInteger(id) && id > 0;
}

export function feed_has_url(feed) {
  assert(feed_is_feed(feed));
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
  if (!feed_is_feed(feed)) {
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
export function feed_merge(oldFeed, newFeed) {
  const mergedFeed = Object.assign(feed_create(), oldFeed, newFeed);

  // After assignment, the merged feed has only the urls from the new feed. So
  // the output feed's url list needs to be fixed. First copy over the old
  // feed's urls, then try and append each new feed url.
  mergedFeed.urls = [...oldFeed.urls];

  if (newFeed.urls) {
    for (const urlString of newFeed.urls) {
      feed_append_url(mergedFeed, new URL(urlString));
    }
  }

  return mergedFeed;
}

export function entry_create() {
  return {magic: ENTRY_MAGIC};
}

// Return true if the first parameter looks like an entry object
export function entry_is_entry(value) {
  // note: typeof null === 'object', hence the truthy test
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Return true if the first parameter looks like an entry id
export function entry_is_valid_id(value) {
  return Number.isInteger(value) && value > 0;
}

// Returns true if the entry has at least one url
export function entry_has_url(entry) {
  assert(entry_is_entry(entry));
  return entry.urls && (entry.urls.length > 0);
}

// Returns the last url, as a string, in the entry's url list. This should never
// be called on an entry without urls.
// TODO: because this returns a string, be more explicit about it. I just caught
// myself expecting URL.
export function entry_peek_url(entry) {
  assert(entry_is_entry(entry));
  assert(entry_has_url(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the urls property if
// needed. Normalizes the url. The normalized url is compared against existing
// urls to ensure the new url is unique. Returns true if entry was added, or
// false if the url already exists and was therefore not added
export function entry_append_url(entry, url) {
  assert(entry_is_entry(entry));
  assert(url instanceof URL);

  const normalUrlString = url.href;
  if (entry.urls) {
    if (entry.urls.includes(normalUrlString)) {
      return false;
    }

    entry.urls.push(normalUrlString);
  } else {
    entry.urls = [normalUrlString];
  }

  return true;
}

// Returns the url used to lookup a feed's favicon
// Note this expects an actual feed object, not any object. The magic property
// must be set
// @returns {URL}
export function feed_create_favicon_lookup_url(feed) {
  assert(feed_is_feed(feed));

  // First, prefer the link, as this is the url of the webpage that is
  // associated with the feed. Cannot assume the link is set or valid. But if
  // set, can assume it is valid.
  if (feed.link) {
    try {
      return new URL(feed.link);
    } catch (error) {
      // If feed.link is set it should always be a valid URL
      console.warn(error);

      // If the url is invalid, just fall through
    }
  }

  // If the link is missing or invalid then use the origin of the feed's xml
  // url. Assume the feed always has a url.
  const urlString = feed_peek_url(feed);
  const urlObject = new URL(urlString);
  return new URL(urlObject.origin);
}
