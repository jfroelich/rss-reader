// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function archiveEntries() {
  console.log('Archiving entries...');
  let processedEntryCount = 0, archivedEntryCount = 0;
  const EXPIRES_AFTER_MS = 10 * 24 * 60 * 60 * 1000;
  const currentDate = new Date();
  db.open(onConnect);

  function onConnect(event) {
    // Exit early if we failed to connect (e.g. blocked)
    if(event.type !== 'success') {
      console.debug(event);
      onComplete();
      return;
    }

    const connection = event.target.result;
    db.openReadUnarchivedEntryCursor(connection, handleCursor);
  }

  // Check if the entry at the current cursor position should be archived, and
  // if so, archive it, and then proceed to the next entry.

  function handleCursor(event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      onComplete();
      return;
    }

    processedEntryCount++;
    const entry = cursor.value;

    // Temporary support for legacy entry storage
    if(!entry.dateCreated && entry.created) {
      entry.dateCreated = new Date(entry.created);
    }

    let ageInMillis = 0;

    // If we do not know when the entry was created, then assume it is
    // archivable. Fake the age as whatever will always trigger the condition
    // to archive.
    if(!entry.dateCreated) {
      console.debug('Unknown entry date created, archiving');
      ageInMillis = EXPIRES_AFTER_MS + 1;
    } else {
      // NOTE: we know that both of these dates were created locally on the
      // client, so there is no risk that a server yields strange
      // dates. The only issue is when the client changes the system clock
      // in between archive runs.
      ageInMillis = getDateDifferenceInMilliseconds(currentDate,
        entry.dateCreated);
    }

    if(ageInMillis > EXPIRES_AFTER_MS) {
      const archivedEntry = getArchivableEntry(entry);
      cursor.update(archivedEntry);
      sendArchiveRequestedMessage(archivedEntry);
      archivedEntryCount++;
    }
    cursor.continue();
  }

  function onComplete() {
    console.log('Archived %s of %s entries', archivedEntryCount,
      processedEntryCount);
  }
}

function getDateDifferenceInMilliseconds(date1, date2) {
  return date1 - date2;
}

function getArchivableEntry(inputEntry) {
  const outputEntry = Object.create(null);
  outputEntry.id = inputEntry.id;
  outputEntry.feed = inputEntry.feed;
  outputEntry.urls = inputEntry.urls;

  if(inputEntry.dateRead) {
    outputEntry.dateRead = inputEntry.dateRead;
  }

  outputEntry.dateArchived = new Date();
  outputEntry.archiveState = db.EntryFlags.ARCHIVED;
  return outputEntry;
}

function sendArchiveRequestedMessage(entry) {
  const message = {
    'type': 'archiveEntryRequested',
    'entryId': entry.id
  };
  chrome.runtime.sendMessage(message);
}
