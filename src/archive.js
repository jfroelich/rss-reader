// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Lib for archiving old entries
// Requires: /src/db.js
// Requirse: /src/entry.js


/////////////////
/// EXPERIMENTAL BRAINSTORMING CODE

/*
class ArchiveService {
  static run() {
    console.log('Archiving entries');
    db_open(this.onConnect);
  }

  static onConnect(event) {
  }
}


const ArchiveService = {

  function run() {

  },
  function onOpen(event) {

  }
};


*/


/////////////////////


// Queries storage for currently archivable entries and archives them.
function archive_entries() {
  console.log('Archiving entries');
  db_open(archive_entries_on_connect);
}

// Open a read-write transaction on the entry store and request all
// entries that are not archived and marked as read, and then start iterating.
function archive_entries_on_connect(event) {
  if(event.type !== 'success') {
    console.debug(event);
    return;
  }

  const stats = {
    processed: 0,
    archived: 0
  };

  // Open a cursor over all entries that are read and not archived
  const connection = event.target.result;
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = archive_entries_on_complete.bind(transaction,
    stats);
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [ENTRY_FLAGS.UNARCHIVED, ENTRY_FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = archive_next_entry.bind(request, stats);
}

// Check if the entry at the current cursor position should be archived, and if
// so, archive it, and then proceed to the next entry.
function archive_next_entry(stats, event) {
  const request = event.target;
  const cursor = request.result;

  // Either no entries found or completed iteration
  if(!cursor) {
    return;
  }

  stats.processed++;

  // 30 days
  const EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

  const entry = cursor.value;

  // TODO: access dateCreated once field is renamed
  // TODO: the object will be a Date object once I make other changes so
  // the calculation here needs to change.

  const ageInMillis = Date.now() - entry.created;
  const shouldArchiveEntry = ageInMillis > EXPIRES_AFTER_MS;

  if(shouldArchiveEntry) {
    const newEntry = archive_get_archivable_entry(entry);

    // Trigger a new request but do not wait for it to complete
    const asyncUpdateRequest = cursor.update(newEntry);

    // Notify listeners of the state change
    const archiveMessage = {
      'type': 'archivedEntry',
      'entryId': entry.id
    };
    chrome.runtime.sendMessage(archiveMessage);

    stats.archived++;
  }

  cursor.continue();
}

// Returns an entry object suitable for storage. This contains only those
// fields that should persist after archive.
function archive_get_archivable_entry(inputEntry) {
  const outputEntry = {};

  // Maintain id because it is required to uniquely identify and reference
  // entries in the store.
  outputEntry.id = inputEntry.id;

  // Maintain feed id because we need to be able to remove archived entries
  // as a result of unsubscribing from a feed.
  outputEntry.feed = inputEntry.feed;

  // Maintain link because we still want to represent that the entry already
  // exists when comparing a new entry to existing entries.
  outputEntry.link = inputEntry.link;

  // NOTE: this was previously named archiveDate, some entries currently
  // exist in my testing storage with the old field and not the new field.
  // NOTE: this previously used a timestamp instead of a Date object.
  // TODO: I need to reset the database and then I can delete this comment.
  outputEntry.dateArchived = new Date();

  outputEntry.archiveState = ENTRY_FLAGS.ARCHIVED;
  return outputEntry;
}

function archive_entries_on_complete(stats, event) {
  console.log('Archived %s of %s entries', stats.archived, stats.processed);
}
