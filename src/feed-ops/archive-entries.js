import assert from "/src/common/assert.js";
import sizeof from "/src/feed-ops/sizeof.js";
import * as Entry from "/src/feed-store/entry.js";
import {open as openFeedStore} from "/src/feed-store/feed-store.js";

// TODO: eventually reconsider how an entry is determined as archivable. Each entry should
// specify its own lifetime as a property, at the time of creation of update. This should then
// just be scanning for entries that whose lifetimes have expired. This pattern is more in line
// with how traditional cached object lifetimes are calculated. Using this alternate approach
// allows each entry to manage its own lifetime. For example, I could say that for all entries
// coming from a certain feed, those entries should have a half-life.
// TODO: maybe differentiating between the message type 'entry-updated' and
// 'entry-archived' is pendantic. Maybe this should be deferring to the putEntry
// call to post a message. Or, perhaps I should introduce a reason code to the
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
