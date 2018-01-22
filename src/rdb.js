import {open as utilsOpen} from "/src/common/indexeddb-utils.js";
import {replaceTags, truncateHTML} from "/src/common/html-utils.js";

// TODO: if the file is so large, what I could do is present a unifying module that simply
// imports from a bunch of helper files and then exports from here, and expect users to
// import from here instead of directly from helpers. I've noticed this is an extremely
// common practice in other open-source projects. I guess it is some kind of
// single point of entry pattern? If I do this I think first I should do the other changes
// and then examine the size of the module afterward. This will increase file coherency
// without increasing coupling.
// TODO: I should be more consistent in field names. A have a semi-hungarian notation, where
// the type is the suffix, but sometimes I use it as the prefix (e.g. dateUpdated should be
// renamed to updatedDate)
// TODO: regarding feed schema, should the group of properties pertaining to a feed's active state
// by grouped together into a sub object? Like:
// {active-props: {active: true, deactivationReasonText: undefined, deactivationDate: undefined}};
// TODO: the feed active property is poorly named. Something that is named as
// active typically means active. So it would be more appropriate to name this as something
// like activeState or activeFlag. That removes the ambiguity between presence/absence style
// boolean, and true/false boolean.


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

  console.log('Upgrading database %s to version %s from version', conn.name, conn.version,
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
    // deleteIndex to avoid the not-found error

    // @type {DOMStringList}
    const indices = feedStore.indexNames;
    if(indices.contains('title')) {
      console.debug('Deleting title index of feed store as part of upgrade');
      feedStore.deleteIndex('title');
    } else {
      console.debug('No title index found to delete during upgrade past version 22');
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
    console.error(getAllEntriesRequest.error);
  };
  getAllEntriesRequest.onsuccess = function(event) {
    const entries = event.target.result;
    writeEntriesWithMagic(store, entries);
  };
}

function writeEntriesWithMagic(entryStore, entries) {
  for(const entry of entries) {
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
    for(const feed of feeds) {
      feed.magic = FEED_MAGIC;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  }
}

function addActiveFieldToFeeds(store) {
  console.debug('Adding active property to feeds');
  const feedsRequest = store.getAll();
  feedsRequest.onerror = console.error;

  feedsRequest.onsuccess = function(event) {
    const feeds = event.target.result;
    for(const feed of feeds) {
      console.debug('Marking feed %d as active as part of upgrade', feed.id);
      feed.active = true;
      feed.dateUpdated = new Date();
      store.put(feed);
    }
  };
}

export async function activateFeed(conn, channel, feedId) {
  assert(isValidFeedId(feedId), 'Invalid feed id', feedId);
  const dconn = conn ? conn : await open();
  await activateFeedPromise(dconn, feedId);
  if(!conn) {
    dconn.close();
  }
  if(channel) {
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
      assert(feed.active, 'Feed %d is already active', feedId);
      feed.active = true;
      delete feed.deactivationReasonText;
      delete feed.deactivateDate;
      feed.dateUpdated = new Date();
      store.put(feed);
    };
  });
}

export async function deactivateFeed(conn, channel, feedId, reasonText) {
  assert(isValidFeedId(feedId), 'Invalid feed id ' + feedId);
  const dconn = conn ? conn : await open();
  await deactivateFeedPromise(dconn, feedId, reasonText);
  if(!conn) {
    dconn.close();
  }
  if(channel) {
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

export async function addEntry(conn, channel, entry) {
  assert(isEntry(entry), 'Invalid entry ' + entry);
  assert(!entry.id);

  // TODO: I am not sure if I call this here, or in putEntry, or not at all
  validateEntry(entry);

  // TODO: I wonder if sanitization is a concern for something earlier in the
  // processing pipeline, and at this point, only validation is a concern, and
  // no magical mutations should happen

  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = ENTRY_STATE_UNREAD;
  storable.archiveState = ENTRY_STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  delete storable.dateUpdated;

  // NOTE: this function is not concerned with dynamically connecting to the database.
  // This delegates that concern entirely to putFeed. By using putFeed, this function
  // can also claim that it dynamically connects.

  // Pass a null channel to putEntry to suppress its message. This function
  // posts its own entry-added message in place of the entry-updated message.
  let nullChannel = null;
  const entryId = await putEntry(conn, nullChannel, storable);

  if(channel) {
    channel.postMessage({type: 'entry-added', id: entryId});
  }

  storable.id = entryId;
  return storable;
}

export async function countUnreadEntries(conn) {
  const dconn = conn ? conn : await open();
  const count = await countUnreadEntriesPromise(dconn);
  console.debug('Counted %d unread entries', count);
  if(!conn) {
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

export async function markEntryRead(conn, channel, entryId) {
  assert(isValidEntryId(entryId), 'Invalid entry id ' + entryId);

  const dconn = conn ? conn : await open();
  await markEntryReadPromise(dconn, entryId);
  if(!conn) {
    dconn.close();
  }

  if(channel) {
    channel.postMessage({type: 'entry-marked-read', id: entryId});
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

      if(entry.readState === ENTRY_STATE_READ) {
        console.warn('Entry %d already in read state, ignoring', entry.id);
        return;
      }

      if(entry.readState !== ENTRY_STATE_UNREAD) {
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

export async function findActiveFeeds(conn) {
  const feeds = await getFeeds(conn);
  return feeds.filter(feed => feed.active);
}

// TODO: if this is only called by one place then it should be inlined there.
// I am overly abstracting and attempting to provide flexiblity when there is no alternate
// use case at the moment.
async function findEntryIdByURL(conn, url) {
  const dconn = conn ? conn : await open();
  const entryId = await findEntryIdByURLPromise(dconn, url);
  if(!conn) {
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

export async function containsEntryWithURL(conn, url) {
  const entryId = await findEntryIdByURL(conn, url);
  return isValidEntryId(entryId);
}

export async function findFeedById(conn, feedId) {
  const dconn = conn ? conn : await open();
  const feed = await findFeedByIdPromise(dconn, feedId);
  if(!conn) {
    dconn.close();
  }
  return feed;
}

function findFeedByIdPromise(conn, feedId) {
  return new Promise((resolve, reject) => {
    assert(isValidFeedId(feedId));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: inline this into containsFeedWithURL
async function findFeedIdByURL(conn, url) {
  const dconn = conn ? conn : await open();
  const feedId = await findFeedIdByURLPromise(dconn, url);
  if(!conn) {
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

export async function containsFeedWithURL(conn, url) {
  const feedId = await findFeedIdByURL(conn, url);
  return isValidFeedId(id);
}

export async function findViewableEntries(conn, offset, limit) {
  const dconn = conn ? conn : await open();
  const entries = await findViewableEntriesPromise(dconn, offset, limit);
  if(!conn) {
    dconn.close();
  }
  return entries;
}

// TODO: reconsider getAll
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
}

export async function getFeeds(conn) {
  const dconn = conn ? conn : await open();
  const feeds = await getFeedsPromise(dconn);
  if(!conn) {
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
  if(!conn) {
    dconn.close();
  }

  if(channel) {
    channel.postMessage({type: 'entry-updated', id: entryId});
  }

  return entryId;
}

function putEntryPromise(conn, entry) {
  return new Promise((resolve, reject) => {
    assert(isEntry(entry));
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function prepareFeed(feed) {
  let prepped = sanitizeFeed(feed);
  prepped = filterEmptyProps(prepped);
  return prepped;
}

export async function addFeed(conn, channel, feed) {
  // TODO: call validateFeed first. Or actually can delegate it to putFeed since that also
  // has to call it.
  const preparedFeed = prepareFeed(feed);

  // Initialize certain properties
  preparedFeed.active = true;
  preparedFeed.dateCreated = new Date();
  delete preparedFeed.dateUpdated;

  let nullChannel = null;
  const feedId = await putFeed(conn, nullChannel, preparedFeed);
  preparedFeed.id = feedId;

  if(channel) {
    channel.postMessage({type: 'feed-added', id: feedId});
  }

  return preparedFeed;
}

export async function putFeed(conn, channel, feed) {
  const dconn = conn ? conn : await open();
  const feedId = await putFeedPromise(dconn, feed);
  if(!conn) {
    dconn.close();
  }

  // TODO: when updating, is put result still the feed id? I know
  // that result is feed id when adding, but what about updating? Review
  // the documentation on IDBObjectStore.prototype.put

  if(channel) {
    channel.postMessage({type: 'feed-updated', id: feed.id ? feed.id : feedId});
  }

  return feedId;
}

function putFeedPromise(conn, feed) {
  return new Promise((resolve, reject) => {
    assert(isFeed(feed));
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function removeFeed(conn, channel, feedId, reasonText) {
  const dconn = conn ? conn : await open();
  const entryIds = await removeFeedPromise(dconn, feedid);
  if(!conn) {
    dconn.close();
  }

  if(channel) {
    channel.postMessage({type: 'feed-deleted', id: feedId, reason: reasonText});
    for(const id of entryIds) {
      channel.postMessage({type: 'entry-deleted', id: id, reason: reasonText});
    }
  }
}

function removeFeedPromise(conn, feedId) {
  return new Promise(function executor(resolve, reject) {
    assert(isValidFeedId(feedId));
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
      for(const id of entryIds) {
        console.debug('Deleting entry', id);
        entryStore.delete(id);
      }
    };
  });
}

// Returns a shallow copy of the input feed with sanitized properties
function sanitizeFeed(feed, titleMaxLength, descMaxLength) {
  if(typeof titleMaxLength === 'undefined') {
    titleMaxLength = 1024;
  }

  if(typeof descMaxLength === 'undefined') {
    descMaxLength = 1024 * 10;
  }

  const blankFeed = createFeed();
  const outputFeed = Object.assign(blankFeed, feed);
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

// Inspect the entry object and throw an error if any value is invalid
// or any required properties are missing
function validateEntry(entry) {
  // TODO: implement
  // By not throwing an error, this indicates the entry is valid
}

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

  const blankEntry = createEntry();
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

// Returns a new object that is a copy of the input less empty properties. A property is empty if
// it is null, undefined, or an empty string. Ignores prototype, deep objects, getters, etc.
// Shallow copy by reference.
function filterEmptyProps(object) {
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const output = {};
  let undef;
  if(typeof object === 'object' && object !== null) {
    for(const key in object) {
      if(hasOwnProp.call(object, key)) {
        const value = object[key];
        if(value !== undef && value !== null && value !== '') {
          output[key] = value;
        }
      }
    }
  }

  return output;
}

// If the input is a string then the function returns a new string that is approximately a copy of
// the input less certain 'unprintable' characters. In the case of bad input the input itself is
// returned. To test if characters were replaced, check if the output string length is less than
// the input string length.
function filterUnprintableCharacters(value) {

  // Basically this removes those characters in the range of [0..31] except for:
  // \t is \u0009 which is base10 9
  // \n is \u000a which is base10 10
  // \f is \u000c which is base10 12
  // \r is \u000d which is base10 13
  // TODO: look into how much this overlaps with filterControls

  const pattern = /[\u0000-\u0008\u000b\u000e-\u001F]+/g;
  // The length check is done because given that replace will be a no-op when the length is 0 it is
  // faster to perform the length check than it is to call replace. I do not know the distribution
  // of inputs but I expect that empty strings are not rare.
  return typeof value === 'string' && value.length ? value.replace(pattern, '') : value;
}

// Returns a new string where Unicode Cc-class characters have been removed. Throws an error if
// string is not a defined string. Adapted from these stack overflow questions:
// http://stackoverflow.com/questions/4324790
// http://stackoverflow.com/questions/21284228
// http://stackoverflow.com/questions/24229262
function filterControls(string) {
  return string.replace(/[\x00-\x1F\x7F-\x9F]+/g, '');
}

function assert(value, message) {
  if(!value) throw new Error(message || 'Assertion error');
}

export function createFeed() {
  return {magic: FEED_MAGIC};
}

// Return true if the value looks like a feed object
export function isFeed(value) {
  return value && typeof value === 'object' && value.magic === FEED_MAGIC;
}

export function isValidFeedId(id) {
  return Number.isInteger(id) && id > 0;
}

export function feedHasURL(feed) {
  assert(isFeed(feed));
  return feed.urls && (feed.urls.length > 0);
}

// Returns the last url in the feed's url list as a string
// @param feed {Object} a feed object
// @returns {String} the last url in the feed's url list
export function feedPeekURL(feed) {
  assert(feedHasURL(feed));
  return feed.urls[feed.urls.length - 1];
}

// Appends a url to the feed's internal list. Lazily creates the list if needed
// @param feed {Object} a feed object
// @param url {URL}
export function feedAppendURL(feed, url) {

  if(!isFeed(feed)) {
    console.error('Invalid feed argument:', feed);
    return false;
  }

  if(!(url instanceof URL)) {
    console.error('Invalid url argument:', url);
    return false;
  }

  feed.urls = feed.urls || [];
  const href = url.href;
  if(feed.urls.includes(href)) {
    return false;
  }
  feed.urls.push(href);
  return true;
}

// Returns a new object that results from merging the old feed with the new feed. Fields from the
// new feed take precedence, except for urls, which are merged to generate a distinct ordered set of
// oldest to newest url. Impure because of copying by reference.
export function mergeFeeds(oldFeed, newFeed) {
  const mergedFeed = Object.assign(createFeed(), oldFeed, newFeed);

  // After assignment, the merged feed has only the urls from the new feed. So the output feed's url
  // list needs to be fixed. First copy over the old feed's urls, then try and append each new feed
  // url.
  mergedFeed.urls = [...oldFeed.urls];

  if(newFeed.urls) {
    for(const urlString of newFeed.urls) {
      feedAppendURL(mergedFeed, new URL(urlString));
    }
  }

  return mergedFeed;
}

export function createEntry() {
  return {magic: ENTRY_MAGIC};
}

// Return true if the first parameter looks like an entry object
export function isEntry(value) {
  // note: typeof null === 'object', hence the truthy test
  return value && typeof value === 'object' && value.magic === ENTRY_MAGIC;
}

// Return true if the first parameter looks like an entry id
export function isValidEntryId(value) {
  return Number.isInteger(value) && value > 0;
}

// Returns true if the entry has at least one url
export function entryHasURL(entry) {
  assert(isEntry(entry));
  return entry.urls && (entry.urls.length > 0);
}

// Returns the last url, as a string, in the entry's url list. This should never be called on an
// entry without urls.
export function entryPeekURL(entry) {
  assert(isEntry(entry));
  assert(entryHasURL(entry));
  return entry.urls[entry.urls.length - 1];
}

// Append a url to an entry's url list. Lazily creates the urls property if needed. Normalizes the
// url. The normalized url is compared against existing urls to ensure the new url is unique.
// Returns true if entry was added, or false if the url already exists and was therefore
// not added
export function entryAppendURL(entry, url) {
  assert(isEntry(entry));
  assert(url instanceof URL);

  const normalUrlString = url.href;
  if(entry.urls) {
    if(entry.urls.includes(normalUrlString)) {
      return false;
    }

    entry.urls.push(normalUrlString);
  } else {
    entry.urls = [normalUrlString];
  }

  return true;
}

// Returns the url used to lookup a feed's favicon
// Note this expects an actual feed object, not any object. The magic property must be set
// @returns {URL}
export function createIconLookupURLForFeed(feed) {
  assert(isFeed(feed));

  // First, prefer the link, as this is the url of the webpage that is associated with the feed.
  // Cannot assume the link is set or valid. But if set, can assume it is valid.
  if(feed.link) {

    try {
      return new URL(feed.link);
    } catch(error) {
      // If feed.link is set it should always be a valid URL
      console.warn(error);

      // If the url is invalid, just fall through
    }
  }

  // If the link is missing or invalid then use the origin of the feed's xml url. Assume the feed
  // always has a url.
  const urlString = feedPeekURL(feed);
  const urlObject = new URL(urlString);
  return new URL(urlObject.origin);
}
