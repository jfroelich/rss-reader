// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// TODO: this feature needs more thought put into it, this is 
// currently in a temporary semi-working state
// TODO: is it possible to archive an article loaded in the view?
// TODO: avoid archiving unread articles?
// TODO: stop using feed index, we plan to keep feed to stop 
// generating orphans. Think of another way to select entries
// that are not already archived
function archiveEntries() {
  'use strict';

  const tracker = {
    processed: 0
  };

  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

  const ENTRY_LIMIT = 1000;

  openDatabaseConnection(function(error, connection) {
    if(error) {
      console.debug(error);
      return;
    }
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor();
    request.onsuccess = onEntry;
  });

  function onComplete(event) {
    'use strict';
    console.log('Archived %s entries', tracker.processed);
  }

  function onEntry(event) {
    const cursor = event.target.result;
    if(!cursor) {
      return;
    }

    tracker.processed++;

    const entry = cursor.value;

    if(entry.archiveDate) {
      cursor.continue();
      return;
    }

    const now = Date.now();
    const age = now - entry.created;
    if(age > EXPIRES_AFTER_MS) {
      delete entry.content;
      delete entry.feed;
      delete entry.feedLink;
      delete entry.feedTitle;
      delete entry.pubdate;
      delete entry.readDate;
      delete entry.title;
      entry.archiveDate = now;
      cursor.update(entry);
    }
    
    if(tracker.processed <= ENTRY_LIMIT) {
      cursor.continue();
    }
  }
}
