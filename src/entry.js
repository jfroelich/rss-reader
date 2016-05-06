// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Entry utilities
// Requires: /src/db.js

const ENTRY_FLAGS = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

// TODO: maybe make a separate private helper function that prepares the
// entry for storage, as opposed to doing it all in a single function?
// TODO: maybe the prepareEntryForStorage function should be its own global
// function and the caller has the responsibility of preparation and then the
// only concern of this function is to do an update?
// TODO: i really just don't like the fact I have to wrap the callback
// function, so think about this would have to be changed to not do that
// TODO: make sure pubdate has a consistent value. I am using
// date.getTime here, but I am not sure I am using the same
// or similar every where else. Like in poll denormalize
// TODO: I should be using Date objects for date values. Not timestamps.
function entry_put(connection, entry, callback) {
  const storable = {};

  // TODO: won't this always be defined? If it is a required field,
  // why even check?
  if(entry.id) {
    storable.id = entry.id;
  }

  if('feedLink' in entry) {
    storable.feedLink = entry.feedLink;
  }

  if('feedTitle' in entry) {
    storable.feedTitle = entry.feedTitle;
  }

  if('feed' in entry) {
    storable.feed = entry.feed;
  }

  if('link' in entry && entry.link) {
    storable.link = entry.link;
  }

  if('readState' in entry) {
    storable.readState = entry.readState;
  } else {
    storable.readState = ENTRY_FLAGS.UNREAD;
  }

  if('dateRead' in entry) {
    storable.dateRead = entry.dateRead;
  }

  if('author' in entry && entry.author) {
    storable.author = entry.author;
  }

  if('title' in entry && entry.title) {
    storable.title = entry.title;
  }

  // TODO: the pubdate field should be named datePublished so as to be
  // consistent with other field names
  // TODO: store a Date object instead of a timestamp
  if(entry.pubdate) {
    const date = new Date(entry.pubdate);
    if(utils.date.isValid(date)) {
      storable.pubdate = date.getTime();
    }
  }

  // TODO: rename to dateCreated
  // TODO: store a Date object instead of a timestamp
  if('created' in entry) {
    storable.created = entry.created;
  } else {
    storable.created = Date.now();
  }

  if('content' in entry && entry.content) {
    storable.content = entry.content;
  }

  if('archiveState' in entry) {
    storable.archiveState = entry.archiveState;
  } else {
    storable.archiveState = ENTRY_FLAGS.UNARCHIVED;
  }

  // Use an isolated transaction for storing an entry. The problem with using a
  // shared transaction in the case of a batch insert is that the uniqueness
  // check from index constraints is db-delegated and unknown apriori without a
  // separate lookup request, and that any constraint failure causes the entire
  // transaction to fail.

  const transaction = connection.transaction('entry', 'readwrite');

  // TODO: deprecate async lib usage in calling context so that this can
  // just call callback directly by assigning it to transaction.oncomplete
  // Right now it is wrapped so as to avoid passing callback any arguments
  // because any argument indicates an error and therefore an iteration
  // stopping condition when using async.forEach
  transaction.oncomplete = function transaction_on_complete_wrapper() {
    callback();
  };

  const store = transaction.objectStore('entry');
  store.put(storable);
}
