// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class ArchiveService {
  constructor() {
    this.log = new LoggingService();
    const tenDaysInMillis = 10 * 24 * 60 * 60 * 1000;
    this.expiresAfterMillis = tenDaysInMillis;
    this.cache = new FeedCache();
  }

  start() {
    this.log.log('Running archive service ...');
    const context = {
      'numEntriesProcessed': 0,
      'numEntriesChanged': 0,
      'currentDate': new Date()
    };

    this.cache.open(this.onConnect.bind(this, context));
  }

  onComplete(context) {
    this.log.info('Archived %s of %s entries', context.numEntriesChanged,
      context.numEntriesProcessed);
  }

  onConnect(context, connection) {
    this.log.debug('Archive service connected to database');
    if(!connection) {
      this.onComplete(context);
      return;
    }

    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const index = store.index('archiveState-readState');
    const keyPath = [FeedCache.EntryFlags.UNARCHIVED,
      FeedCache.EntryFlags.READ];
    const request = index.openCursor(keyPath);
    const boundHandleCursor = this.handleCursor.bind(this, context);
    request.onsuccess = boundHandleCursor;
    request.onerror = boundHandleCursor;
  }

  handleCursor(context, event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      this.onComplete(context);
      return;
    }

    context.numEntriesProcessed++;
    const entry = cursor.value;

    const entryURLString = entry.urls[entry.urls.length - 1];

    this.log.debug('Archive service examining', entryURLString);

    // Temporary support for legacy entry storage
    if(!entry.dateCreated && entry.created) {
      entry.dateCreated = new Date(entry.created);
      this.log.debug('Archive service found legacy entry date', entry.created,
        entry.dateCreated);
    }

    let ageInMillis = this.getEntryAge(context.currentDate, entry);
    if(ageInMillis > this.expiresAfterMillis) {
      this.log.debug('Archiving service archiving', entryURLString);
      const archivedEntry = ArchiveService.getArchivableEntry(entry);
      // This is async, we don't wait for it to complete
      cursor.update(archivedEntry);
      ArchiveService.sendArchiveRequestedMessage(archivedEntry);
      context.numEntriesChanged++;
    }
    cursor.continue();
  }

  // If we do not know when the entry was created, then assume it is
  // archivable. Fake the age as whatever will always trigger the condition
  // to archive.
  getEntryAge(currentDate, entry) {
    let ageInMillis = 0;
    if(entry.dateCreated) {
      ageInMillis = currentDate - entry.dateCreated;
    } else {
      this.log.debug('Archive service unknown entry date created', entry);
      ageInMillis = this.expiresAfterMillis + 1;
    }
    return ageInMillis;
  }

  static sendArchiveRequestedMessage(entry) {
    const message = {
      'type': 'archiveEntryRequested',
      'entryId': entry.id
    };
    chrome.runtime.sendMessage(message);
  }

  static getArchivableEntry(inputEntry) {
    const outputEntry = {};
    outputEntry.id = inputEntry.id;
    outputEntry.feed = inputEntry.feed;
    outputEntry.urls = inputEntry.urls;
    outputEntry.dateArchived = new Date();
    outputEntry.archiveState = FeedCache.EntryFlags.ARCHIVED;
    if(inputEntry.dateRead) {
      outputEntry.dateRead = inputEntry.dateRead;
    }
    return outputEntry;
  }
}
