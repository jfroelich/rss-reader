// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

// TODO: specify Database as a dependency injection
// TODO: specify EntryStore as a dependency?

this.archiveEntries = function() {
  Database.open(archiveOnConnect);
};

function archiveOnConnect(event) {

  const stats = {
    processed: 0
  };

  if(event.type === 'success') {
    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onArchiveComplete.bind(
      transaction, stats);
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

// Private helper for archiveEntries
function onArchiveComplete(stats, event) {
  console.log('Archive processed %s entries, archived %s', stats.processed,
    stats.archived);
}

}
