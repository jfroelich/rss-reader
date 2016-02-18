// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/storage/entry-store.js
// Requires: /src/utils.js

// TODO: maybe make a separate private helper function that prepares the
// entry for storage, as opposed to doing it all in a single function
// TODO: maybe the prepareEntryForStorage function should be its own global
// function and the caller has the responsibility of preparation and then the
// only concern of this function is to do an update?
// TODO: i really just don't like the fact I have to wrap the callback
// function, so think about this would have to be changed to not do that

// Adds or updates the entry within the database
function storeEntry(connection, entry, callback) {
  'use strict';

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
    if(utils.isValidDate(date)) {
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
