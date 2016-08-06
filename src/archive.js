// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const archive = {};

archive.start = function(expiresAfterMillis) {
  console.log('Arching entries...');
  console.assert(typeof expiresAfterMillis === 'undefined' ||
    (!isNaN(expiresAfterMillis) && expiresAfterMillis > 0),
    'expiresAfterMillis must be a positive integer if provided');
  const tenDaysInMillis = 10 * 24 * 60 * 60 * 1000;

  const context = {
    'expiresAfterMillis': expiresAfterMillis || tenDaysInMillis,
    'numEntriesProcessed': 0,
    'numEntriesChanged': 0,
    'currentDate': new Date()
  };

  openIndexedDB(archive.onOpenDatabase.bind(null, context));
};

archive.onOpenDatabase = function(context, connection) {
  if(!connection) {
    archive.onComplete(context);
    return;
  }

  // Open a cursor over entries not archived and read
  context.connection = connection;
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [Entry.FLAGS.UNARCHIVED, Entry.FLAGS.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = archive.openCursorOnSuccess.bind(request, context);
  request.onerror = archive.openCursorOnError.bind(request, context);
};

archive.openCursorOnSuccess = function(context, event) {
  const cursor = event.target.result;
  if(!cursor) {
    archive.onComplete(context);
    return;
  }

  context.numEntriesProcessed++;
  const entry = cursor.value;
  const ageInMillis = archive.getEntryAge(context, entry);
  if(ageInMillis > context.expiresAfterMillis) {
    console.debug('Archiving entry', Entry.prototype.getURL.call(entry));
    const archivedEntry = Entry.prototype.archive.call(entry);
    // Async
    cursor.update(archivedEntry);
    // Async
    archive.sendMessage(archivedEntry.id);
    context.numEntriesChanged++;
  }
  cursor.continue();
};

archive.openCursorOnError = function(context, event) {
  console.error(event);
  archive.onComplete(context);
};

archive.getEntryAge = function(context, entry) {
  let age = 0;
  if(entry.dateCreated) {
    // Subtract the date to get the difference in milliseconds
    console.assert(context.currentDate > entry.dateCreated,
      'Entry was created after current date', entry.dateCreated);
    age = context.currentDate - entry.dateCreated;
  } else {
    // Use a fake age that guarantees archival
    console.warn('Unknown entry date created', entry);
    age = context.expiresAfterMillis + 1;
  }
  return age;
};

archive.sendMessage = function(entryId) {
  chrome.runtime.sendMessage({
    'type': 'archiveEntryRequested',
    'entryId': entryId
  });
};

archive.onComplete = function(context) {
  if(context.connection) {
    context.connection.close();
  }

  if(context.numEntriesProcessed) {
    console.log('Archived %s of %s entries', context.numEntriesChanged,
      context.numEntriesProcessed);
  } else {
    console.log('Archive completed with no entries processed');
  }
};
