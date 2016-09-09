// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// The default period after which entries become archivable
const TEN_DAYS_MS = 10 * 24 * 60 * 60 * 1000;

// Iterates over entries that have not been archived and have been read, and
// archives entries that are older. Archiving shrinks the size of the stored
// entry object in the database.
// @param expires {number} an entry is archivable if older than this.
// if not set, a default value of 10 days is used.
function archiveEntries(expires) {
  console.log('Archiving entries...');

  // Create a shared context for simple sharing of state across function
  // invocations.
  const context = {
    'expires': TEN_DAYS_MS,
    'numEntriesProcessed': 0,
    'num_changed': 0,
    'current_date': new Date()
  };

  if(expires) {
    console.assert(!isNaN(expires));
    console.assert(isFinite(expires));
    console.assert(expires > 0);
    context.expires = expires;
  }

  openDB(onOpenDB.bind(context));
}

function onOpenDB(db) {
  if(!db) {
    onComplete.call(this);
    return;
  }

  this.db = db;
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [ENTRY_FLAGS.UNARCHIVED, ENTRY_FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = openCursorOnsuccess.bind(this);
  request.onerror = openCursorOnerror.bind(this);
}

function openCursorOnsuccess(event) {
  const cursor = event.target.result;

  // Either there were no entries, or we advanced the cursor past the end,
  // in which case the scan is complete.
  if(!cursor) {
    onComplete.call(this);
    return;
  }

  // Keep track of the number of entries visisted by the scan, regardless of
  // whether the entry will be modified.
  this.numEntriesProcessed++;

  const entry = cursor.value;
  const terminalURLString = getEntryURL(entry);
  console.assert(terminalURLString);
  console.assert(entry.dateCreated);

  // Entries should never have been created in the future. If so, age will be
  // negative and the age check below fails, so the entry will remain unarchived
  // indefinitely.
  console.assert(entry.dateCreated.getTime() < this.current_date.getTime());

  // Subtracting two dates implicitly yields a difference in milliseconds
  const age = this.current_date - entry.dateCreated;

  // If the entry is older than the expiration period, then it should be
  // archived.
  if(age > this.expires) {
    console.debug('Archiving', terminalURLString);
    const archivedEntry = entryToArchivable(entry);
    // Async request that indexedDB replace the old object with the new object
    cursor.update(archivedEntry);

    // Async showDesktopNotification other windows that the entry was archived. This only
    // exposes id so as to minimize surface area, and to reduce the size of the
    // message sent. I don't think any listeners need any more information than
    // this.
    chrome.runtime.sendMessage({
      'type': 'archiveEntryPending',
      'entry_id': entry.id
    });

    // Track that the entry was archived
    this.num_changed++;
  }

  // Async advance cursor
  cursor.continue();
}

// Returns a new entry object representing the archived form of the input entry
function entryToArchivable(inputEntry) {

  console.assert(inputEntry);

  // TODO: consider whether Object.create(null) is better. I think
  // tentatively that the structured clone algorithm will implicitly ignore
  // the object's prototype.
  const outputEntry = {};

  // Flag the entry as archived so that it will not be scanned in the future
  outputEntry.archiveState = ENTRY_FLAGS.ARCHIVED;
  // Introduce a new property representing the date the entry was archived.
  // This is the only place where this property is introduced.
  outputEntry.dateArchived = new Date();

  // There is no need to clone because this function is only ever used in a
  // known context
  outputEntry.dateCreated = inputEntry.dateCreated;

  // Does not assume the entry has been read, so cannot assume that dateRead
  // is set. If not set then do not create a property with a null value.
  if(inputEntry.dateRead) {
    // There is no need to clone because this function is only ever used in a
    // known context.
    outputEntry.dateRead = inputEntry.dateRead;
  }

  // Maintain the feed id so that if the user unsubscribes the archived entry
  // will still be picked up and deleted.
  console.assert(inputEntry.feed);
  outputEntry.feed = inputEntry.feed;

  // Maintain the id. This is required in order to put the new object back into
  // the store using an inline key.
  outputEntry.id = inputEntry.id;

  // Maintain whatever is the current read state. An unread entry can still be
  // archived if it is too old.
  outputEntry.readState = inputEntry.readState;

  // An input entry should always have at least one url
  console.assert(inputEntry.urls);
  console.assert(inputEntry.urls.length);

  // NOTE: there actually is no need to clone, I don't need to ensure purity
  // here because this is only used in a known context, where I know that the
  // caller does not do any manipulating to the urs array after calling this
  outputEntry.urls = inputEntry.urls;

  return outputEntry;
}

function openCursorOnerror(event) {
  console.error(event.target.error);
  onComplete.call(this);
}

function onComplete() {
  console.log('Archived %s of %s entries', this.num_changed,
    this.numEntriesProcessed);
  if(this.db) {
    this.db.close();
  }
}

this.archiveEntries = archiveEntries;

} // End file block scope
