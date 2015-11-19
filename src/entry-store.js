// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const EntryStore = {};

{ // BEGIN ANONYMOUS NAMESPACE

EntryStore.UNREAD = 0;
EntryStore.READ = 1;
EntryStore.UNARCHIVED = 0;
EntryStore.ARCHIVED = 1;

// Adds or updates the entry within the database
function put(connection, entry, callback) {
  // console.debug('Putting entry %s', entry.link);
  const storable = {};

  if(entry.id) {
    storable.id = entry.id;
  }

  if(entry.hasOwnProperty('feedLink')) {
    storable.feedLink = entry.feedLink;
  }

  if(entry.hasOwnProperty('feedTitle')) {
    storable.feedTitle = entry.feedTitle;
  }

  if(entry.hasOwnProperty('feed')) {
    storable.feed = entry.feed;
  }

  if(entry.link) {
    storable.link = entry.link;
  }

  if(entry.hasOwnProperty('readState')) {
    storable.readState = entry.readState;
  } else {
    storable.readState = EntryStore.UNREAD;
  }

  if(entry.hasOwnProperty('readDate')) {
    storable.readDate = entry.readDate;
  }

  if(entry.author) {
    storable.author = entry.author;
  }

  if(entry.title) {
    storable.title = entry.title;
  }

  // TODO: make sure pubdate has a consistent value. I am using
  // date.getTime here, but I am not sure I am using the same
  // or similar every where else. Like in poll denormalize
  if(entry.pubdate) {
    const date = new Date(entry.pubdate);
    if(DateUtils.isValid(date)) {
      storable.pubdate = date.getTime();
    }
  }
  
  if(entry.hasOwnProperty('created')) {
    storable.created = entry.created;
  } else {
    storable.created = Date.now();
  }

  if(entry.content) {
    storable.content = entry.content;
  }

  if(entry.hasOwnProperty('archiveState')) {
    storable.archiveState = entry.archiveState;
  } else {
    storable.archiveState = EntryStore.UNARCHIVED;
  }

  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = function() { 
    callback(); 
  };
  transaction.objectStore('entry').put(storable);
}

EntryStore.put = put;

// Updates the read state of the corresponding entry in the database
function markRead(connection, id) {
  // console.debug('Marking entry %s as read', id);
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(id);
  request.onsuccess = markReadOnOpenCursor;
}

EntryStore.markRead = markRead;

// Private helper for markRead
function markReadOnOpenCursor(event) {

  const cursor = event.target.result;
  if(!cursor) {
    return;
  }

  const entry = cursor.value;
  if(!entry) {
    return;
  }

  if(entry.readState === EntryStore.READ) {
    return;
  }

  // TODO: update date-updated as well
  entry.readState = EntryStore.READ;
  entry.readDate = Date.now();
  cursor.update(entry);

  const connection = event.target.transaction.db;
  BrowserActionUtils.update(connection);

  chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
}

function countUnread(connection, callback) {
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const range = IDBKeyRange.only(EntryStore.UNREAD);
  const request = index.count(range);
  request.onsuccess = callback;
}

EntryStore.countUnread = countUnread;

function findByLink(connection, entry, callback) {
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entry.link);
  request.onsuccess = callback;
}

EntryStore.findByLink = findByLink;

function removeByFeed(connection, id, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = store.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(id);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
}

EntryStore.removeByFeed = removeByFeed;

function clear(connection) {
  if(connection) {
    _clear(connection);
  } else {
    Database.open(function(event) {
      _clear(event.target.result);
    });
  }
}

EntryStore.clear = clear;

// Private helper for clear
function _clear(connection) {
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = function(event) {
    console.debug('Cleared entry object store');
  };
  transaction.objectStore('entry').clear();
}

function archiveEntries() {
  Database.open(archiveOnConnect);
}

EntryStore.archiveEntries = archiveEntries;

// Private helper for archiveEntries
function archiveOnConnect(event) {
  
  const stats = {
    processed: 0
  };

  if(event.type === 'success') {
    const connection = event.target.result;
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onArchiveComplete.bind(
      transaction, stats);
    const store = transaction.objectStore('entry');
    const index = store.index('archiveState-readState');
    const range = IDBKeyRange.only([EntryStore.UNARCHIVED, 
      EntryStore.READ]);
    const request = index.openCursor(range);
    request.onsuccess = archiveNextEntry.bind(request, stats);
  } else {
    console.debug('Archive aborted due to connection error %o', event);
  }
}

const ARCHIVE_EXPIRES_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

// Private helper for archiveEntries
function archiveNextEntry(stats, event) {
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
    // Update archiveState and create archiveDate
    delete entry.content;
    delete entry.feedLink;
    delete entry.feedTitle;
    delete entry.pubdate;
    delete entry.readDate;
    delete entry.created;
    delete entry.updated;
    delete entry.title;
    delete entry.author;
    entry.archiveState = EntryStore.ARCHIVED;
    entry.archiveDate = now;
    cursor.update(entry);
    chrome.runtime.sendMessage({type: 'archivedEntry', entry: entry});
  }
  
  cursor.continue();
}

// Private helper for archiveEntries
function onArchiveComplete(stats, event) {
  console.log('Archive processed %s entries, archived %s', stats.processed, 
    stats.archived);
}

} // END ANONYMOUS NAMESPACE
