// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const EntryStore = {};
EntryStore.UNREAD = 0;
EntryStore.READ = 1;
EntryStore.UNARCHIVED = 0;
EntryStore.ARCHIVED = 1;

{ // BEGIN ANONYMOUS NAMESPACE

// Adds or updates the entry within the database
// TODO: inject dependency on isValidDate instead of hardcoding it?

EntryStore.put = function(connection, entry, callback) {
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
    if(isValidDate(date)) {
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

  // TODO: i really just don't like the fact I have to wrap the function
  // here, so think about this would have to be changed to not do that

  transaction.oncomplete = function() {
    callback();
  };
  transaction.objectStore('entry').put(storable);
};

// Updates the read state of the corresponding entry in the database
// TODO: inject dependency on updateBadge instead of hard coding it
// within markReadOnOpenCursor
EntryStore.markRead = function(connection, id) {
  // console.debug('Marking entry %s as read', id);
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(id);
  request.onsuccess = markReadOnOpenCursor;
};

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

  // Retrieve the connection from within the current transaction
  const connection = event.target.transaction.db;
  updateBadge(EntryStore, connection);


/*

// Thinking about something like this, a domain specific type.
// But, is it overly specific? Do we want a more general object,
// like SimpleMessage(type, value)?
// Or, do want to avoid using type, because the caller should be
// using instanceof?
// Or, should it be fully polymorphic, there is no type, there is just
// some message behavior that the caller uses somehow? but then where is the
// behavior defined?

function EntryReadMessage(entry) {
  this.type = 'entryRead';
  this.entry = entry;
}

EntryReadMessage.prototype = {
  get entry() {
    return this.entry;
  }
};

const entryReadMessage = new EntryReadMessage(entry);
chrome.runtime.sendMessage(entryReadMessage);
*/

  chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
}

EntryStore.countUnread = function(connection, callback) {
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const range = IDBKeyRange.only(EntryStore.UNREAD);
  const request = index.count(range);
  request.onsuccess = callback;
};

EntryStore.findByLink = function(connection, entry, callback) {
  const transaction = connection.transaction('entry');
  const entries = transaction.objectStore('entry');
  const links = entries.index('link');
  const request = links.get(entry.link);
  request.onsuccess = callback;
};

EntryStore.removeByFeed = function(connection, id, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  const store = transaction.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(id);
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      cursor.delete();
      cursor.continue();
    }
  };
};

// TODO: specify Database as a dependency injection
EntryStore.clear = function(connection) {
  if(connection) {
    _clear(connection);
  } else {
    openIndexedDB(function(event) {
      _clear(event.target.result);
    });
  }
};

// Private helper for clear
function _clear(connection) {
  const transaction = connection.transaction('entry', 'readwrite');
  transaction.oncomplete = function(event) {
    console.debug('Cleared entry object store');
  };
  transaction.objectStore('entry').clear();
}

} // END ANONYMOUS NAMESPACE
