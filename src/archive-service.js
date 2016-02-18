// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /storage/open-indexeddb.js
// Requires: /storage/entry-store.js

const ArchiveService = {};

ArchiveService.archiveEntries = function() {
  'use strict';
  console.log('Archiving entries');
  openIndexedDB(ArchiveService.onConnect);
};

ArchiveService.onConnect = function(event) {
  'use strict';

  if(event.type !== 'success') {
    console.debug(event);
    return;
  }

  const stats = {
    processed: 0,
    archived: 0
  };

  const connection = event.target.result;
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = ArchiveService.onComplete.bind(transaction, stats);
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const range = IDBKeyRange.only([EntryStore.UNARCHIVED,
    EntryStore.READ]);
  const request = index.openCursor(range);
  request.onsuccess = ArchiveService.archiveNextEntry.bind(request, stats);
};

ArchiveService.archiveNextEntry = function(stats, event) {
  'use strict';

  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
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
};

ArchiveService.onComplete = function(stats, event) {
  console.log('Archived %s of %s entries', stats.archived, stats.processed);
};
