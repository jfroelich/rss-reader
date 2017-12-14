import assert from "/src/assert/assert.js";
import replaceTags from "/src/html/replace-tags.js";
import htmlTruncate from "/src/html/truncate.js";
import * as IndexedDbUtils from "/src/indexeddb/utils.js";
import updateBadgeText from "/src/reader/update-badge-text.js";
import * as Entry from "/src/reader-db/entry.js";
import {InvalidStateError, NotFoundError} from "/src/reader-db/errors.js";
import * as Feed from "/src/reader-db/feed.js";
import openDb from "/src/reader-db/open.js";
import putEntry from "/src/reader-db/put-entry.js";
import putFeed from "/src/reader-db/put-feed.js";
import removeEntries from "/src/reader-db/remove-entries.js";
import removeFeed from "/src/reader-db/remove-feed.js";
import setup from "/src/reader-db/setup.js";
import condenseWhitespace from "/src/string/condense-whitespace.js";
import filterUnprintableCharacters from "/src/string/filter-unprintable-characters.js";
import filterControls from "/src/string/filter-controls.js";
import {isValidURLString} from "/src/url/url-string.js";
import check from "/src/utils/check.js";
import filterEmptyProps from "/src/utils/filter-empty-props.js";
import isPosInt from "/src/utils/is-pos-int.js";

// TODO: inline reader-db modules here

// TODO: only some of the merged modules used this technique, change all inlined code to
// call dprintf instead of calling console directly
const DEBUG = false;
const dprintf = DEBUG ? console.log : function(){};


export default function FeedStore() {
  /* IDBDatabase */ this.conn;
}

FeedStore.prototype.open = async function() {
  this.conn = await openDb();
};

FeedStore.prototype.isOpen = function() {
  return IndexedDbUtils.isOpen(this.conn);
};

FeedStore.prototype.close = function() {
  IndexedDbUtils.close(this.conn);
};

FeedStore.prototype.activateFeed = async function(feedId) {
  console.debug('activateFeed start', feedId);
  assert(this.isOpen());
  assert(Feed.isValidId(feedId));

  const feed = await this.findFeedById(feedId);
  assert(Feed.isFeed(feed));
  console.debug('Successfully loaded feed object', feed);
  if(feed.active === true) {
    console.debug('Feed with id %d is already active', feed.id);
    return false;
  }

  changeFeedPropsToActive(feed);

  // We have full control for lifetime so skip prep
  const skipPrep = true;
  await this.putFeed(feed, skipPrep);
  console.debug('Activated feed', feedId);
  return true;
};

function changeFeedPropsToActive(feed) {
  feed.active = true;
  // I guess just permanently erase?
  delete feed.deactivationReasonText;
  delete feed.deactivationDate;
  feed.dateUpdated = new Date();
}

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
// call to filterControls here. There is some redundant work going on. Also, in a sense,
// filterControls is now inaccurate. What I want is one function that strips binary
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

  assert(isPosInt(authorMaxLength));
  assert(isPosInt(titleMaxLength));
  assert(isPosInt(contextMaxLength));

  const blankEntry = Entry.createEntry();
  const outputEntry = Object.assign(blankEntry, inputEntry);

  if(outputEntry.author) {
    let author = outputEntry.author;
    author = filterControls(author);
    author = replaceTags(author, '');
    author = condenseWhitespace(author);
    author = htmlTruncate(author, authorMaxLength);
    outputEntry.author = author;
  }

  if(outputEntry.content) {
    let content = outputEntry.content;
    content = filterUnprintableCharacters(content);
    content = htmlTruncate(content, contextMaxLength);
    outputEntry.content = content;
  }

  if(outputEntry.title) {
    let title = outputEntry.title;
    title = filterControls(title);
    title = replaceTags(title, '');
    title = condenseWhitespace(title);
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
  console.debug('Deactivating feed', feedId);
  const feed = await this.findFeedById(feedId);
  assert(Feed.isFeed(feed));
  console.debug('Successfully loaded feed object for deactivation', feed);

  if(feed.active === false) {
    console.warn('Feed %d is inactive', feed.id);
    return false;
  }

  changeFeedPropsToInactive(feed, reason);

  // We have full control over lifetime of feed object so skip prep
  const skipPrep = true;
  await store.putFeed(feed, skipPrep);
  console.debug('Deactivated feed', feedId);
  return true;
};

function changeFeedPropsToInactive(feed, reason) {
  feed.active = false;
  if(typeof reason === 'string') {
    feed.deactivationReasonText = reason;
  }
  const currentDate = new Date();
  feed.deactivationDate = currentDate;
  feed.dateUpdated = currentDate;
}

// TODO: if performance eventually becomes a material concern this should probably interact
// directly with the database. For now, because the filtering is done after deserialization there
// is not much benefit to direct interaction and instead it makes more sense to leverage existing
// functionality.
FeedStore.prototype.findActiveFeeds = async function() {
  assert(this.isOpen());
  const feeds = await this.getAllFeeds();
  return feeds.filter(isActiveFeed);
};

// Explicitly test whether the active property is defined and of boolean type. This is just
// an extra sanity check in case the property gets clobbered somewhere. But rather than a full
// on assert I do not handle the error explicitly and consider the feed as inactive. What this
// means is that if I ever see no feeds being loaded but I know they exist, this is probably
// the reason.
function isActiveFeed(feed) {
  return feed.active === true;
}

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
// is basically using the predicate for.
FeedStore.prototype.findArchivableEntries = function(predicate, limit) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(typeof predicate === 'function');

    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(isPosInt(limit));
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

FeedStore.prototype.findEntries = function(predicate, limit) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(typeof predicate === 'function');
    const limited = typeof limit !== 'undefined';
    if(limited) {
      assert(isPosInt(limit));
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
// TODO: change to accept URL object, change assertion to check instanceof URL
// @param urlString {String}
FeedStore.prototype.findEntryIdByURL = function(urlString) {
  return new Promise((resolve, reject) => {
    assert(this.isOpen());
    assert(isValidURLString(urlString));
    const tx = this.conn.transaction('entry');
    const store = tx.objectStore('entry');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
    assert(isValidURLString(urlString));
    const tx = this.conn.transaction('feed');
    const store = tx.objectStore('feed');
    const index = store.index('urls');
    const request = index.getKey(urlString);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
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
  // TODO: use stricter type check (implicit magic)
  assert(typeof entry !== 'undefined');

  // The entry should ALWAYS have a url
  assert(Entry.hasURL(entry));

  // TODO: I am not sure this check is strict enough. Technically the entry should always be
  // in the UNREAD state at this point.
  check(entry.readState !== Entry.STATE_READ, InvalidStateError,
    'Entry %d already in read state', entryId);

  const url = Entry.peekURL(entry);
  dprintf('Found entry to mark as read', entryId, url);

  // We have full control over the entry object from read to write, so there is no need to sanitize
  // or filter empty properties.
  entry.readState = Entry.STATE_READ;
  entry.dateUpdated = new Date();
  entry.dateRead = entry.dateUpdated;

  await this.putEntry(entry);
  dprintf('Marked entry as read', entryId, url);
  await updateBadgeText(this);
};

FeedStore.prototype.putEntry = function(entry) {
  return putEntry(this.conn, entry);
};

// TODO: to remove the skipPrep param, create addFeed. If prep needed use addFeed to add. If
// prep not needed call put feed directly.
FeedStore.prototype.putFeed = function(feed, skipPrep) {
  return putFeed(feed, this.conn, skipPrep);
};

FeedStore.prototype.removeEntries = function(entryIds) {
  return removeEntries(this.conn, entryIds);
};

FeedStore.prototype.removeFeed = function(feedId, entryIds) {
  return removeFeed(this.conn, feedId, entryIds);
};

FeedStore.prototype.setup = setup;
