// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class ArchiveService {
  constructor() {
    this.log = new DummyLoggingService();
    this.expiresAfterMillis = 10 * 24 * 60 * 60 * 1000;
  }

  start() {
    this.log.log('Running archive service ...');

    const context = {
      'numEntriesProcessed': 0,
      'numEntriesChanged': 0,
      'currentDate': new Date()
    };

    db.open(this.onConnect.bind(this, context));
  }

  onComplete(context) {
    this.log.info('Archived %s of %s entries', context.numEntriesChanged,
      context.numEntriesProcessed);
  }

  onConnect(context, event) {
    this.log.debug('Connected to database');
    // Exit early if we failed to connect (e.g. blocked)
    if(event.type !== 'success') {
      this.log.error(event);
      this.onComplete(context);
      return;
    }

    const connection = event.target.result;
    db.openReadUnarchivedEntryCursor(connection,
      this.handleCursor.bind(this, context));
  }

  // Check if the entry at the current cursor position should be archived, and
  // if so, archive it, and then proceed to the next entry.
  handleCursor(context, event) {
    const request = event.target;
    const cursor = request.result;

    if(!cursor) {
      this.onComplete(context);
      return;
    }

    context.numEntriesProcessed++;
    const entry = cursor.value;

    this.log.debug('Archive service processing entry with url',
      entry.urls[entry.urls.length - 1]);

    // Temporary support for legacy entry storage
    if(!entry.dateCreated && entry.created) {
      entry.dateCreated = new Date(entry.created);
      this.log.debug('Found legacy entry date', entry.created,
        entry.dateCreated);
    }

    let ageInMillis = this.getEntryAge(context, entry);
    if(ageInMillis > this.expiresAfterMillis) {
      this.log.debug('Archiving entry with url',
        entry.urls[entry.urls.length - 1]);
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
  getEntryAge(context, entry) {
    let ageInMillis = 0;
    if(entry.dateCreated) {
      ageInMillis = context.currentDate - entry.dateCreated;
    } else {
      this.log.debug('Unknown entry date created', entry);
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

  // Creates the new object to store in place of the older object
  static getArchivableEntry(inputEntry) {
    const outputEntry = {};
    outputEntry.id = inputEntry.id;
    outputEntry.feed = inputEntry.feed;
    outputEntry.urls = inputEntry.urls;
    outputEntry.dateArchived = new Date();
    outputEntry.archiveState = db.EntryFlags.ARCHIVED;
    if(inputEntry.dateRead) {
      outputEntry.dateRead = inputEntry.dateRead;
    }
    return outputEntry;
  }
}
