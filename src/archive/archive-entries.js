// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /storage/open-indexeddb.js

'use strict';

{ // BEGIN ANONYMOUS NAMESPACE

function archiveEntries() {
  openIndexedDB(onConnect);
}

this.archiveEntries = archiveEntries;

// todo: use a more qualified name here
function onConnect(event) {

  const stats = {
    processed: 0,
    archived: 0
  };

  if(event.type === 'success') {
    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete.bind(transaction, stats);
    const store = transaction.objectStore('entry');
    const index = store.index('archiveState-readState');
    const range = IDBKeyRange.only([EntryStore.UNARCHIVED,
      EntryStore.READ]);
    const request = index.openCursor(range);
    request.onsuccess = archiveNextEntry.bind(request, stats);
  } else {
    console.debug('Archive aborted due to connection error %o', event);
  }
}

const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Private helper for archiveEntries
function archiveNextEntry(stats, event) {
  const cursor = event.target.result;
  if(!cursor)
    return;
  stats.processed++;
  const entry = cursor.value;
  const now = Date.now();

  // todo: use a more qualified name
  const age = now - entry.created;
  if(age > EXPIRES_AFTER_MS) {
    stats.archived++;

    // Leave intact entry.id, entry.feed, entry.link
    // Update archiveState and create archiveDate
    delete entry.content;
    delete entry.feedLink;
    delete entry.feedTitle;
    delete entry.pubdate;
    delete entry.readDate;
    delete entry.created;
    delete entry.updated;
    delete entry.title;
    delete entry.author;
    entry.archiveState = EntryStore.ARCHIVED;
    entry.archiveDate = now;
    cursor.update(entry);
    chrome.runtime.sendMessage({type: 'archivedEntry', entry: entry});
  }

  cursor.continue();
}

// TODO: qualify the name more
function onComplete(stats, event) {
  console.log(
    'The archive service processed %s entries and archived %s entries',
    stats.processed,
    stats.archived);
}

} // END ANONYMOUS NAMESPACE
