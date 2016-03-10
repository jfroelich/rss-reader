// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/db.js

(function(exports) {

'use strict';

function archiveEntries() {
  console.log('Archiving entries');
  db.open(onConnect);
}

function onConnect(event) {
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
  transaction.oncomplete = onComplete.bind(transaction, stats);
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const range = IDBKeyRange.only([db.EntryFlags.UNARCHIVED,
    db.EntryFlags.READ]);
  const request = index.openCursor(range);
  request.onsuccess = archiveNextEntry.bind(request, stats);
}

const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

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
    delete entry.content;
    delete entry.feedLink;
    delete entry.feedTitle;
    delete entry.pubdate;
    delete entry.readDate;
    delete entry.created;
    delete entry.updated;
    delete entry.title;
    delete entry.author;
    entry.archiveState = db.EntryFlags.ARCHIVED;
    entry.archiveDate = now;
    cursor.update(entry);
    chrome.runtime.sendMessage({type: 'archivedEntry', entry: entry});
  }

  cursor.continue();
}

function onComplete(stats, event) {
  console.log('Archived %s of %s entries', stats.archived, stats.processed);
}

exports.archiveEntries = archiveEntries;

} (this));
