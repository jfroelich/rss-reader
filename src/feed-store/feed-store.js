import assert from "/src/common/assert.js";
import {open as utilsOpen} from "/src/common/indexeddb-utils.js";
import * as Entry from "/src/feed-store/entry.js";
import * as Feed from "/src/feed-store/feed.js";
import {onUpgradeNeeded} from "/src/feed-store/upgrade.js";
import {
  filterEmptyProps,
  sanitizeEntry,
  sanitizeFeed,
  validateEntry
} from "/src/feed-store/utils.js";

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
// TODO: addFeed should post channel messages.

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

export async function addEntry(conn, channel, entry) {
  assert(Entry.isEntry(entry), 'Invalid entry', entry);
  assert(!entry.id);

  // TODO: I am not sure if I call this here, or in putEntry, or not at all
  validateEntry(entry);

  // TODO: I wonder if sanitization is a concern for something earlier in the
  // processing pipeline, and at this point, only validation is a concern, and
  // no magical mutations should happen

  const sanitized = sanitizeEntry(entry);
  const storable = filterEmptyProps(sanitized);
  storable.readState = Entry.STATE_UNREAD;
  storable.archiveState = Entry.STATE_UNARCHIVED;
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
      //assert(entry.readState !== Entry.STATE_READ);

      if(entry.readState === Entry.STATE_READ) {
        console.warn('Entry %d already in read state, ignoring', entry.id);
        return;
      }


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
    assert(Feed.isFeed(feed));
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
    assert(Feed.isValidId(feedId));
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
