import {open as openHelper} from "/src/common/indexeddb-utils.js";
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

// NOTE: the following TODO is actively being done
// TODO: in hindsight, there is little need for an object. This could just export a bunch
// of basic promise-returning functions and be much simpler. The open function could simply
// accept an options argument that overrides defaults for testing purposes. The rest of the
// app can call open without the options argument. Then there is no longer a need to
// export everything in a big object. Callers do not need to allocate and can instead directly
// call functions. I can still export functions like isOpen and close to shield direct
// interaction with IndexedDbUtils. I am allowing the module to become the context rather
// than shoehorning an object into a module. There is practically no state involved other
// than the conn property so that is about the only benefit of an object.
// TODO: after refactoring review which functions are used only locally and ensure they are
// not exported

// TODO: it is possible that feed.js and entry.js should be merged into this file

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

// TODO: be consistent in precondition assertions. Do them as promise rejections, not before
// starting the promise.

// TODO: which reminds me, addFeed, putFeed, addEntry, and putEntry in feed-store should
// all post channel messages

// TODO: create an addFeed function that forwards to putFeed in the style of addEntry/putEntry



export function open(name = 'reader', version = 24, timeout = 500) {
  return openHelper(name, version, onUpgradeNeeded, timeout);
}

export async function activateFeed(conn, feedId) {
  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return Status.EINVAL;
  }

  // TODO: this should be using a single read-write transaction instead of two transactions in
  // order to ensure consistency.

  console.debug('Activating feed', feedId);
  let [status, feed] = await findFeedById(conn, feedId);
  if(status !== Status.OK) {
    console.error('Error finding feed by id', feedId, Status.toString(status));
    return status;
  }

  console.debug('Found feed to activate', feedId, feed.title);

  if(feed.active) {
    console.debug('Feed %d is already active', feedId);
    return Status.EINVALIDSTATE;
  }

  // Transition feed properties from active to inactive state. Minizing storage size is preferred
  // over maintaining v8 object shape.
  feed.active = true;
  delete feed.deactivationReasonText;
  delete feed.deactivationDate;
  feed.dateUpdated = new Date();

  [status] = await putFeed(conn, feed);
  if(status !== Status.OK) {
    console.error('Failed to put feed:', Status.toString(status));
    return status;
  }

  console.debug('Activated feed', feedId);
  return Status.OK;
}

export async function deactivateFeed(conn, feedId, reason) {
  // TODO: use a single transaction to ensure consistency

  if(!Feed.isValidId(feedId)) {
    console.error('Invalid feed id', feedId);
    return Status.EINVAL;
  }

  let [status, feed] = await findFeedById(conn, feedId);
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

  [status] = await putFeed(conn, feed);
  if(status !== Status.OK) {
    console.error('Failed to put feed', Status.toString(status));
  }

  return status;
}

export async function addEntry(conn, channel, entry) {

  if(!Entry.isEntry(entry)) {
    console.error('Invalid entry argument', entry);
    return [Status.EINVAL];
  }

  // TODO: instead of returning the new id, return the stored object. And set the id of the
  // stored object before returning it. This way the caller can see the sanitized version of the
  // entry.

  // TODO: why not set dateUpdated?

  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
  storable.dateCreated = new Date();

  let [status, entryId] = await putEntry(conn, storable);
  if(status !== Status.OK) {
    console.error('Failed to put entry:', Status.toString(status));
    return [status];
  }

  // Notify observers of the new entry
  if(channel && channel.postMessage) {
    const message = {type: 'entry-added', id: entryId};
    channel.postMessage(message);
  }

  return [Status.OK, entryId];
}


// TODO: move this to utils?
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

// TODO: maybe just return a promise and expect the caller to use try/catch semantics
// It seems kind of silly to have a function that just translates the result into a status
// pattern. How much benefit is there to abstracting away the exception?
export async function countUnreadEntries(conn) {
  try {
    const count = await countUnreadEntriesPromise(conn);
    return [Status.OK, count];
  } catch(error) {
    return [Status.EDB];
  }
}

function countUnreadEntriesPromise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markEntryRead(conn, channel, entryId) {

  // TODO: this needs to be refactored to use a single transaction. Right now it uses two,
  // which opens the door to inconsistency.

  if(!Entry.isValidId(entryId)) {
    console.error('Invalid entry id', entryId);
    return Status.EINVAL;
  }

  let [status, entry] = await findEntryById(conn, entryId);
  if(status !== Status.OK) {
    console.error('Failed to find entry by id:', Status.toString(status));
    return status;
  }

  console.debug('Loaded entry to mark as read %d "%s"', entryId, entry.title);

  if(entry.readState === Entry.STATE_READ) {
    console.error('Entry %d already in read state', entryId);
    return Status.EINVALIDSTATE;
  }

  entry.readState = Entry.STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  [status] = await putEntry(conn, entry);
  if(status !== Status.OK) {
    console.error('Failed to put entry:', Status.toString(status));
  }

  // Notify obververs of the state change
  if(channel && channel.postMessage) {
    channel.postMessage({type: 'entry-marked-read', id: entryId});
  }

  return status;
}

export async function findActiveFeeds(conn) {

  // TODO: if performance eventually becomes a material concern this should probably
  // query by index
  let [status, feeds] = await getAllFeeds(conn);
  if(status !== Status.OK) {
    console.error('Failed to get all feeds:', Status.toString(status));
    return status;
  }

  const activeFeeds = feeds.filter(feed => feed.active);
  return [Status.OK, activeFeeds];
}

export async function findEntries(conn, predicate, limit) {
  if(typeof predicate !== 'function') {
    console.error('predicate is not a function');
    return [Status.EINVAL];
  }

  const limited = typeof limit !== 'undefined';
  if(limited) {
    if(!Number.isInteger(limit) || limit < 1) {
      console.error('limit not a positive integer greater than 0');
      return [Status.EINVAL];
    }
  }

  try {
    const entries = await findEntriesPromise(conn, predicate, limit);
    return [Status.OK, entries];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function findEntriesPromise(conn, predicate, limit) {
  return new Promise((resolve, reject) => {
    const limited = typeof limit !== 'undefined';
    const entries = [];
    const tx = conn.transaction('entry');
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
          if(limited && entries.length >= limit) {
            return;
          }
        }
        cursor.continue();
      }
    };
  });
}

async function findEntryById(conn, entryId) {

  if(!Entry.isValidId(entryId)) {
    console.error('Invalid entry id', entryId);
    return [Status.EINVAL];
  }

  try {
    const entry = await findEntryByIdPromise(conn, entryId);
    return [Status.OK, entry];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function findEntryByIdPromise(conn, entryId) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const request = store.get(entryId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function findEntryIdByURL(conn, url) {
  if(!(url instanceof URL)) {
    console.error('Invalid url argument', url);
    return [Status.EINVAL];
  }

  try {
    const entryId = await findEntryIdByURLPromise(conn, url);
    return [Status.OK, entryId];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function findEntryIdByURLPromise(conn, url) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function containsEntryWithURL(conn, url) {
  const [status, id] = await findEntryIdByURL(conn, url);
  if(status !== Status.OK) {
    return [status];
  }
  return [Status.OK, Entry.isValidId(id)];
}

export async function findFeedById(conn, feedId) {
  try {
    const feed = await findFeedByIdPromise(conn, feedId);
    return [Status.OK, feed];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function findFeedByIdPromise(conn, feedId) {
  return new Promise((resolve, reject) => {
    if(!Feed.isValidId(feedId)) {
      const error = new TypeError('Invalid feed id ' + feedId);
      reject(error);
      return;
    }

    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function findFeedIdByURL(conn, url) {
  try {
    const feedId = await findFeedIdByURLPromise(conn, url);
    return [Status.OK, feedId];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function findFeedIdByURLPromise(conn, url) {
  return new Promise((resolve, reject) => {

    if(!(url instanceof URL)) {
      const error = new TypeError('Invalid url ' + url);
      reject(error);
      return;
    }

    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(url.href);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function containsFeedWithURL(conn, url) {
  const [status, id] = await findFeedIdByURL(conn, url);
  if(status !== Status.OK) {
    return [status];
  }
  return [Status.OK, Feed.isValidId(id)];
}

export async function findViewableEntries(conn, offset, limit) {
  try {
    const entries = await findViewableEntriesPromise(conn, offset, limit);
    return [Status.OK, entries];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

// TODO: look into using getAll again
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
}

async function getAllFeedIds(conn) {
  try {
    const feedIds = await getAllFeedIdsPromise(conn);
    return [Status.OK, feedIds];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function getAllFeedIdsPromise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAllKeys();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: rename? 'All' is implied
export async function getAllFeeds(conn) {
  try {
    const feeds = await getAllFeedsPromise(conn);
    return [Status.OK, feeds];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function getAllFeedsPromise(conn) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function putEntry(conn, entry) {
  if(!Entry.isEntry(entry)) {
    console.error('Invalid entry argument', entry);
    return [Status.EINVAL];
  }

  try {
    const entryId = await putEntryPromise(conn, entry);
    return [Status.OK, entryId];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function putEntryPromise(conn, entry) {
  return new Promise((resolve, reject) => {
    const tx = conn.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const request = store.put(entry);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: maybe move to utils, or move to some new module responsible for sanitization
export function prepareFeed(feed) {
  let prepped = sanitizeFeed(feed);
  prepped = filterEmptyProps(prepped);
  return prepped;
}

export async function putFeed(conn, feed) {
  try {
    const feedId = await putFeedPromise(conn, feed);
    return [Status.OK, feedId];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

function putFeedPromise(conn, feed) {
  return new Promise((resolve, reject) => {

    if(!Feed.isFeed(feed)) {
      const error = new TypeError('Invalid feed argument: ' + feed);
      reject(error);
      return;
    }

    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => {
      const feedId = request.result;
      resolve(feedId);
    };
    request.onerror = () => reject(request.error);
  });
}

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

async function removeEntries(conn, entryIds) {
  try {
    await removeEntriesPromise(conn, entryIds);
    return Status.OK;
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  // TODO: this should be posting entry-deleted messages to a channel?

}

function removeEntriesPromise(conn, entryIds) {
  return new Promise((resolve, reject) => {

    // Avoid creating a transaction when possible
    if(!entryIds.length) {
      resolve();
      return;
    }

    const tx = conn.transaction('entry', 'readwrite');
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    const store = tx.objectStore('entry');
    for(const id of entryIds) {
      console.debug('Removing entry with id', id);
      store.delete(id);
    }
  });
}

export async function removeFeed(conn, feedId, channel, reasonText) {
  try {
    await removeFeedPromise(conn, feedId, channel, reasonText);
    return Status.OK;
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }
}

function removeFeedPromise(conn, feedId, channel, reasonText) {
  return new Promise(function executor(resolve, reject) {

    if(!Feed.isValidId(feedId)) {
      const error = new TypeError('Invalid feed id: ' + feedId);
      reject(error);
      return;
    }

    let entryIds;
    const tx = conn.transaction(['feed', 'entry'], 'readwrite');

    tx.oncomplete = function(event) {
      // Now that the transaction committed, notify observers
      if(channel && channel.postMessage) {
        channel.postMessage({type: 'feed-deleted', id: feedId, reason: reasonText});

        for(const id of entryIds) {
          channel.postMessage({type: 'entry-deleted', id: id, reason: reasonText});
        }
      }

      resolve();
    };

    tx.onerror = () => reject(tx.error);

    const feedStore = tx.objectStore('feed');
    console.debug('Deleting feed with id', feedId);
    feedStore.delete(feedId);

    // Get all entry ids for the feed and then delete them
    const entryStore = tx.objectStore('entry');
    const feedIndex = entryStore.index('feed');
    const getEntryIdsRequest = feedIndex.getAllKeys(feedId);
    getEntryIdsRequest.onsuccess = function(event) {
      entryIds = getEntryIdsRequest.result;
      for(const id of entryIds) {
        console.debug('Deleting entry with id', id);
        entryStore.delete(id);
      }
    };
  });
}

// TODO: rather than assert failure when limit is 0, resolve immediately with an empty array.
// Limit is optional
// TODO: I feel like there is not a need for the predicate function. This is pushing too much
// burden/responsibility to the caller. This should handle the expiration check that the caller
// is basically using the predicate for. Basically the caller should just pass in a date instead
// of a function
export async function findArchivableEntries(conn, predicate, limit) {

  // TODO: move check to promise helper, in which case promise will reject in which case
  // that is identical to an exception in which case I shouldn't even do this check
  if(typeof predicate !== 'function') {
    console.error('Invalid predicate argument', predicate);
    return [Status.EINVAL];
  }

  // TODO: move check to promise helper
  const limited = typeof limit !== 'undefined';
  if(limited) {
    if(!Number.isInteger(limit) || limit < 0) {
      console.error('Invalid express limit argument', limit);
      return [Status.EINVAL];
    }
  }

  try {
    const entries = await findArchivableEntriesPromise(conn, predicate, limit);
    return [Status.OK, entries];
  } catch(error) {
    console.error(error);
    return [Status.EDB];
  }
}

// TODO: if IDBIndex.prototype.getAll supports limit, I should use that

function findArchivableEntriesPromise(conn, predicate, limit) {
  return new Promise((resolve, reject) => {
    const limited = typeof limit !== 'undefined';
    const entries = [];
    const tx = conn.transaction('entry');
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
}

// TODO: this should accept a channel as input? or channelName
// TODO: move to feed-ops
export async function removeLostEntries(conn, limit) {

  // TODO: this should all be taking place using a single transaction to ensure
  // consistency between reads and deletes

  let [status, entries] = await findEntries(conn, isLostEntry, limit);
  if(status !== Status.OK) {
    console.error('Failed to find entries: ', Status.toString(status));
    return status;
  }

  console.debug('Found %d lost entries', entries.length);
  if(!entries.length) {
    return Status.OK;
  }

  const ids = entries.map(entry => entry.id);

  status = await removeEntries(conn, ids);
  if(status !== Status.OK) {
    console.error('Failed to remove entries:', Status.toString(status));
    return status;
  }

  const channel = new BroadcastChannel('reader');
  const message = {type: 'entry-deleted', id: undefined, reason: 'lost'};
  for(const id of ids) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return Status.OK;
}

function isLostEntry(entry) {
  return !Entry.hasURL(entry);
}

// TODO: move to feed-ops
export async function removeOrphanedEntries(conn, limit) {

  // TODO: this should probably be taking place using a single transaction to ensure
  // database consistency between reads and deletes

  let status, feedIds, entries;

  [status, feedIds] = await getAllFeedIds(conn);
  if(status !== Status.OK) {
    console.error('Failed to get feed ids:', Status.toString(status));
    return status;
  }

  function isOrphan(entry) {
    const id = entry.feed;
    return !Feed.isValidId(id) || !feedIds.includes(id);
  }

  [status, entries] = await findEntries(conn, isOrphan, limit);
  if(status !== Status.OK) {
    console.error('Failed to find entries with status', status);
    return status;
  }

  console.debug('Found %s orphans', entries.length);
  if(!entries.length) {
    return Status.OK;
  }

  const orphanIds = entries.map(entry => entry.id);
  status = await removeEntries(conn, orphanIds);
  if(status !== Status.OK) {
    console.error('Failed to remove entries with status', status);
    return status;
  }

  const channel = new BroadcastChannel('reader');
  const message = {type: 'entry-deleted', id: undefined, reason: 'orphan'};
  for(const id of orphanIds) {
    message.id = id;
    channel.postMessage(message);
  }
  channel.close();

  return Status.OK;
}
