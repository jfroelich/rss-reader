import assert from "/src/common/assert.js";
import {open as utilsOpen} from "/src/common/indexeddb-utils.js";
import {replaceTags, truncateHTML} from "/src/common/html-utils.js";
import * as Status from "/src/common/status.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";
import {onUpgradeNeeded} from "/src/feed-store/upgrade.js";
import {
  filterControls,
  filterEmptyProps,
  filterUnprintableCharacters,
  sanitizeEntry,
  validateEntry
} from "/src/feed-store/utils.js";

// TODO: after experimenting with status again, I've noticed it creates basically about
// the same amount of boilerplate. Revert to using exceptions. At least for this module,
// given the plethora of promises.
// In making this change, change all status codes error returns into errors. Change returning
// Status.OK into returning undefined.
// Do not forget to remove status.js import later (I habitually forget this!).

// TODO: for dynamic connections there is no need for finally statement. Leak the connection
// on error. Database operations are not speculative. There is no need to try and recover the
// leaked resource in case of a serious error.

// TODO: for remaining functions
// * remove status
// * revert to asserts
// * ensure message posted properly
// * deprecate auto-connected.js

// TODO: review which functions are used only locally and ensure they are not exported
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
// TODO: create an addFeed function that forwards to putFeed in the style of addEntry/putEntry
// I still need to export prepareFeed, because in the poll-feeds use case it needs to overwrite
// the feed's properties with new unsanitized data.
// TODO: addFeed in feed-store should post channel messages.

export function open(name = 'reader', version = 24, timeout = 500) {
  return utilsOpen(name, version, onUpgradeNeeded, timeout);
}

export async function activateFeed(conn, channel, feedId) {
  assert(Feed.isValidId(feedId), 'Invalid feed id', feedId);
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
  assert(Feed.isValidId(feedId), 'Invalid feed id', feedId);
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

// TODO: make conn optional

export async function addEntry(conn, channel, entry) {
  assert(Entry.isEntry(entry), 'Invalid entry', entry);
  assert(!entry.id);

  // TODO: I am not sure if I call this here, or in putEntry, or not at all
  validateEntry(entry);

  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
  storable.dateCreated = new Date();
  delete storable.dateUpdated;

  // Pass a null channel to putEntry to suppress its message given that we
  // plan to post an entry-added message in its place
  let nullChannel = null;
  const entryId = await putEntry(conn, nullChannel, storable);

  if(channel) {
    channel.postMessage({type: 'entry-added', id: entryId});
  }

  storable.id = entryId;
  return storable;
}

function condenseWhitespace(string) {
  return string.replace(/\s{2,}/g, ' ');
}

export async function countUnreadEntries(conn) {
  const dconn = conn ? conn : await open();
  const count = await countUnreadEntriesPromise(dconn);
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
    const request = index.count(Entry.STATE_UNREAD);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function markEntryRead(conn, channel, entryId) {
  assert(Entry.isValidId(entryId), 'Invalid entry id', entryId);

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
      assert(entry.readState !== Entry.STATE_READ);
      entry.readState = Entry.STATE_READ;
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

async function findEntries(conn, predicate, limit) {
  const dconn = conn ? conn : await open();
  const entries = await findEntriesPromise(dconn, predicate, limit);
  if(!conn) {
    dconn.close();
  }
  return entries;
}

function findEntriesPromise(conn, predicate, limit) {
  return new Promise((resolve, reject) => {
    assert(typeof predicate === 'function');
    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(Number.isInteger(limit) && limit > 0);
    }
    const entries = [];
    const tx = conn.transaction('entry');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entries);

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
  return Entry.isValidId(entryId);
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
    assert(Feed.isValidId(feedId));
    const tx = conn.transaction('feed');
    const store = tx.objectStore('feed');
    const request = store.get(feedId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// TODO: inline, this is only used by one function
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
  return Feed.isValidId(id);
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

export async function putEntry(conn, channel, entry) {
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
    assert(Entry.isEntry(entry));
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

export async function putFeed(conn, channel, feed) {
  const dconn = conn ? conn : await open();
  const feedId = await putFeedPromise(dconn, feed);
  if(!conn) {
    dconn.close();
  }

  // TODO: when updating, is store.put result still the feed id? I know
  // that result is feed id when adding, but what about updating?

  if(channel) {
    channel.postMessage({type: 'feed-updated', id: feed.id ? feed.id : feedId});
  }

  return feedId;
}

function putFeedPromise(conn, feed) {
  return new Promise((resolve, reject) => {
    assert(Feed.isFeed(feed));
    const tx = conn.transaction('feed', 'readwrite');
    const store = tx.objectStore('feed');
    const request = store.put(feed);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}




// BELOW IS NOT YET REFACTORED



// TODO: move to utils

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

  let entries;
  try {
    entries = await findEntries(conn, isLostEntry, limit);
  } catch(error) {
    console.error(error);
    return Status.EDB;
  }

  console.debug('Found %d lost entries', entries.length);
  if(!entries.length) {
    return Status.OK;
  }

  const ids = entries.map(entry => entry.id);

  let status = await removeEntries(conn, ids);
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
