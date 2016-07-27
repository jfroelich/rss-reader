// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class ArchiveService {
  constructor() {
    const tenDaysInMillis = 10 * 24 * 60 * 60 * 1000;
    this.expiresAfterMillis = tenDaysInMillis;
    this.cache = new FeedCache();
  }

  start() {
    console.log('Running archive service...');
    const context = {
      'numEntriesProcessed': 0,
      'numEntriesChanged': 0,
      'currentDate': new Date()
    };

    this.cache.open(this.onConnect.bind(this, context));
  }

  onComplete(context) {
    console.info('Archived %s of %s entries', context.numEntriesChanged,
      context.numEntriesProcessed);
  }

  onConnect(context, connection) {
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

    if(!entry.dateCreated && entry.created) {
      console.warn('Found legacy entry date', entry.created);
      entry.dateCreated = new Date(entry.created);
      delete entry.created;
    }

    const ageInMillis = ArchiveService.getEntryAge(context.currentDate, entry);
    if(ageInMillis > this.expiresAfterMillis) {
      console.log('Archiving entry', Entry.prototype.getURL.call(entry));
      const archivedEntry = ArchiveService.getArchivableEntry(entry);
      // This is async, we don't wait for it to complete
      cursor.update(archivedEntry);
      ArchiveService.sendArchiveRequestedMessage(archivedEntry);
      context.numEntriesChanged++;
    }
    cursor.continue();
  }

  static getEntryAge(currentDate, entry) {
    let ageInMillis = 0;
    if(entry.dateCreated) {
      ageInMillis = currentDate - entry.dateCreated;
    } else {
      console.debug('Unknown entry date created', entry);
      // Use a fake age that guarantees archival
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
