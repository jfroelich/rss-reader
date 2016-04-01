// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Lib for archiving old entries
// Requires: /src/db.js

function archive_entries() {
  'use strict';
  console.log('Archiving entries');
  db_open(archive_on_connect);
}

function archive_on_connect(event) {
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
  transaction.oncomplete = archive_on_complete.bind(transaction, stats);
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [DB_ENTRY_FLAGS.UNARCHIVED, DB_ENTRY_FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = archive_next_entry.bind(request, stats);
}

function archive_next_entry(stats, event) {
  'use strict';

  var ARCHIVE_EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

  const cursor = event.target.result;
  if(!cursor)
    return;

  stats.processed++;
  const entry = cursor.value;
  const now = Date.now();
  const age = now - entry.created;
  if(age > ARCHIVE_EXPIRES_AFTER_MS) {
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
    entry.archiveState = DB_ENTRY_FLAGS.ARCHIVED;
    entry.archiveDate = now;
    cursor.update(entry);
    chrome.runtime.sendMessage({type: 'archivedEntry', entry: entry});
  }

  cursor.continue();
}

function archive_on_complete(stats, event) {
  'use strict';
  console.log('Archived %s of %s entries', stats.archived, stats.processed);
}
