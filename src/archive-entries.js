// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: react to the possibility of archiving entries currently loaded 
// in the view

function archiveEntries() {
  'use strict';

  const tracker = {
    processed: 0
  };

  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
  const ENTRY_LIMIT = 1000;

  openDatabaseConnection(function(event) {
    if(event.type !== 'success') {
      console.debug('Archive aborted due to connection error %o', event);
      return;
    }
    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    const index = store.index('archiveState-readState');
    const range = IDBKeyRange.only([ENTRY_UNARCHIVED, ENTRY_READ]);
    const request = index.openCursor(range);
    request.onsuccess = onEntry;
  });

  function onComplete(event) {
    console.log('Archived %s entries', tracker.processed);
  }

  function onEntry(event) {
    const cursor = event.target.result;
    if(!cursor) {
      return;
    }

    tracker.processed++;

    const entry = cursor.value;

    const now = Date.now();
    const age = now - entry.created;
    if(age > EXPIRES_AFTER_MS) {
      delete entry.content;
      delete entry.feedLink;
      delete entry.feedTitle;
      delete entry.pubdate;
      delete entry.readDate;
      delete entry.title;
      entry.readState = ENTRY_READ; // superfluous, but ensure it
      entry.archiveState = ENTRY_ARCHIVED;
      entry.archiveDate = now;
      cursor.update(entry);
    }

    // TODO: Notify any listeners (views) that the entry is archived. For example,
    // so that slides.html can update?

    if(tracker.processed <= ENTRY_LIMIT) {
      cursor.continue();
    }
  }
}
