// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: do we need a limit on the number of entries archived per 
// run? Maybe that is stupid

function archiveEntries() {
  const tracker = {
    processed: 0
  };

  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
  const ENTRY_LIMIT = 1000;

  Database.open(function(event) {
    if(event.type === 'success') {
      const connection = event.target.result;
      const transaction = connection.transaction('entry', 'readwrite');
      transaction.oncomplete = onComplete;
      const store = transaction.objectStore('entry');
      const index = store.index('archiveState-readState');
      const range = IDBKeyRange.only([ENTRY_UNARCHIVED, ENTRY_READ]);
      const request = index.openCursor(range);
      request.onsuccess = archiveNextEntry;
    } else {
      console.debug('Archive aborted due to connection error %o', event);
    }
  });

  function archiveNextEntry(event) {
    const cursor = event.target.result;
    if(!cursor) {
      return;
    }

    tracker.processed++;
    const entry = cursor.value;

    // We leave intact entry.id, entry.feed, entry.link, update
    // archiveState, and create archiveDate

    const now = Date.now();
    const age = now - entry.created;
    if(age > EXPIRES_AFTER_MS) {
      delete entry.content;
      delete entry.feedLink;
      delete entry.feedTitle;
      delete entry.pubdate;
      delete entry.readDate;
      delete entry.created;
      delete entry.updated;
      delete entry.title;
      delete entry.author;
      entry.archiveState = ENTRY_ARCHIVED;
      entry.archiveDate = now;
      cursor.update(entry);
    }

    chrome.runtime.sendMessage({type: 'archivedEntry', entry: entry});

    if(tracker.processed <= ENTRY_LIMIT) {
      cursor.continue();
    }
  }

  function onComplete(event) {
    console.log('Archived %s entries', tracker.processed);
  }
}
