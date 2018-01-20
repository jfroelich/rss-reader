import assert from "/src/common/assert.js";
import * as Entry from "/src/feed-store/entry.js";
import {open as openFeedStore} from "/src/feed-store/feed-store.js";


// TODO: eventually reconsider how an entry is determined as archivable. Each entry should
// specify its own lifetime as a property, at the time of creation of update. This should then
// just be scanning for entries that whose lifetimes have expired. This pattern is more in line
// with how traditional cached object lifetimes are calculated. Using this alternate approach
// allows each entry to manage its own lifetime. For example, I could say that for all entries
// coming from a certain feed, those entries should have a half-life.

// I think what I want to be doing is re-imagining entry store as a document store. Then look
// at how a traditional document store works, and mimic that caching behavior. I believe it is
// generally done with an expiresDate field of some sort, one that is defined when creating
// the document, or updating it, and is optional. Then archiving becomes simply a matter of
// finding all entries with an expireDate older than the current date. This type of change
// correlates with the goal of removing the feed id foreign key from the entry store and linking
// feeds and entries by feed url instead.

// TODO: maybe differentiating between the message type 'entry-updated' and
// 'entry-archived' is pendantic. Or, perhaps I should introduce a reason code to the
// message.

// TODO: this now no longer layers anything on top of the feed store. It basically is part
// of the model. So why do I have it in feed ops?


// Archives certain entries in the database
// - conn {IDBDatabase} optional, storage database, if not specified then default database will
// be opened, used, and closed
// - maxAge {Number} how long before an entry is considered archivable (using date entry
// created), in milliseconds
// - limit {Number} maximum number of entries to archive
export default async function archiveEntries(conn, channel, maxAge) {
  console.log('Archiving entries...');

  if(typeof maxAge === 'undefined') {
    const TWO_DAYS_MS = 1000 * 60 * 60 * 24 * 2;
    maxAge = TWO_DAYS_MS;
  }

  if(typeof maxAge !== 'undefined') {
    assert(Number.isInteger(maxAge) && maxAge > 0);
  }

  const dconn = conn ? conn : await openFeedStore();
  const entryIds = await archiveEntriesPromise(dconn, maxAge);
  if(!conn) {
    dconn.close();
  }

  if(channel) {
    for(const id of entryIds) {
      channel.postMessage({type: 'entry-archived', id: id});
    }
  }

  console.debug('Archived %d entries', entryIds.length);
}

function archiveEntriesPromise(conn, maxAge) {
  return new Promise((resolve, reject) => {
    const entryIds = [];
    const tx = conn.transaction('entry', 'readwrite');
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve(entryIds);
    const store = tx.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [Entry.STATE_UNARCHIVED, Entry.STATE_READ];
    const request = index.openCursor(keyPath);
    request.onsuccess = () => {
      const cursor = request.result;
      if(!cursor) {
        return;
      }

      const entry = cursor.value;
      if(entry.dateCreated) {
        const currentDate = new Date();
        const age = currentDate - entry.dateCreated;
        if(age > maxAge) {
          const archivedEntry = archiveEntry(entry);
          store.put(archivedEntry);
          entryIds.push(archivedEntry.id);
        }
      }

      cursor.continue();
    };
  });
}

function archiveEntry(entry) {
  const beforeSize = sizeof(entry);
  const compactedEntry = compactEntry(entry);
  const afterSize = sizeof(compactedEntry);
  console.debug('Changing entry %d size from ~%d to ~%d', entry.id, beforeSize, afterSize);

  compactedEntry.archiveState = Entry.STATE_ARCHIVED;
  compactedEntry.dateArchived = new Date();
  compactedEntry.dateUpdated = new Date();
  return compactedEntry;
}

// Create a new entry and copy over certain fields
function compactEntry(entry) {
  const compactedEntry = Entry.createEntry();
  compactedEntry.dateCreated = entry.dateCreated;

  if(entry.dateRead) {
    compactedEntry.dateRead = entry.dateRead;
  }

  compactedEntry.feed = entry.feed;
  compactedEntry.id = entry.id;
  compactedEntry.readState = entry.readState;
  compactedEntry.urls = entry.urls;
  return compactedEntry;
}


// Calculates the approximate byte size of a value. This should only be used for informational
// purposes because it is hilariously inaccurate.
//
// Adapted from http://stackoverflow.com/questions/1248302
//
// Does not work with built-ins, which are objects that are a part of the basic Javascript library,
// like Document, or Element.
//
// This uses a stack internally to avoid recursion
//
// @param inputValue {Any} a value of any type
// @returns {Number} an integer representing the approximate byte size of the input value
function sizeof(inputValue) {
  // visitedObjects is a memoization of previously visited objects. In theory a repeated object
  // just means enough bytes to store a reference value, and only the first object actually
  // allocates additional memory.
  const visitedObjects = [];
  const stack = [inputValue];
  const hasOwnProp = Object.prototype.hasOwnProperty;
  const objectToString = Object.prototype.toString;

  let byteCount = 0;

  while(stack.length) {
    const value = stack.pop();

    // typeof null === 'object'
    if(value === null) {
      continue;
    }

    switch(typeof value) {
    case 'undefined':
      break;
    case 'boolean':
      byteCount += 4;
      break;
    case 'string':
      byteCount += value.length * 2;
      break;
    case 'number':
      byteCount += 8;
      break;
    case 'function':
      // Treat as some kind of function identifier
      byteCount += 8;
      break;
    case 'object':
      if(visitedObjects.indexOf(value) === -1) {
        visitedObjects.push(value);

        if(ArrayBuffer.isView(value)) {
          byteCount += value.length;
        } else if(Array.isArray(value)) {
          stack.push(...value);
        } else {
          const toStringOutput = objectToString.call(value);
          if(toStringOutput === '[object Date]') {
            byteCount += 8; // guess
          } else if(toStringOutput === '[object URL]') {
            byteCount += 2 * value.href.length; // guess
          } else {
            for(let propName in value) {
              if(hasOwnProp.call(value, propName)) {
                // Add size of the property name string itself
                byteCount += propName.length * 2;
                stack.push(value[propName]);
              }
            }
          }
        }
      }
      break;
    default:
      break;// ignore
    }
  }

  return byteCount;
}
