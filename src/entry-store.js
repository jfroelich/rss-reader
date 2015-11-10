// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

class EntryStore {

  static put(connection, entry, callback) {
    // console.debug('Putting entry %s', entry.link);
    const storable = {};
    
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
    transaction.objectStore('entry').add(storable);
  }

  static markRead(connection, id) {
    // console.debug('Marking entry %s as read', id);
    const transaction = connection.transaction('entry', 'readwrite');
    const store = transaction.objectStore('entry');
    const request = store.openCursor(id);
    request.onsuccess = function(event) {
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

      entry.readState = EntryStore.READ;
      entry.readDate = Date.now();
      cursor.update(entry);
      Badge.update(connection);
      chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
    };
  }

  static countUnread(connection, callback) {
    const transaction = connection.transaction('entry');
    const store = transaction.objectStore('entry');
    const index = store.index('readState');
    const range = IDBKeyRange.only(EntryStore.UNREAD);
    const request = index.count(range);
    request.onsuccess = callback;
  }

  static findByLink(connection, entry, callback) {
    const transaction = connection.transaction('entry');
    const entries = transaction.objectStore('entry');
    const links = entries.index('link');
    const request = links.get(entry.link);
    request.onsuccess = callback;
  }

  static removeByFeed(connection, id, callback) {
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

  static clear(connection) {
    if(connection) {
      EntryStore._clear(connection);
    } else {
      Database.open(function(event) {
        EntryStore._clear(event.target.result);
      });
    }
  }

  static _clear(connection) {
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = function(event) {
      console.debug('Cleared entry object store');
    };
    transaction.objectStore('entry').clear();
  }
}

EntryStore.UNREAD = 0;
EntryStore.READ = 1;
EntryStore.UNARCHIVED = 0;
EntryStore.ARCHIVED = 1;
