// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const db = Object.create(null);

db.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

db.open = function(callback) {
  const request = indexedDB.open('reader', 20);
  request.onupgradeneeded = db.upgrade;
  request.onsuccess = callback;
  request.onerror = callback;
  request.onblocked = callback;
};

db.upgrade = function(event) {
  console.log('Upgrading database from version %s', event.oldVersion);

  const request = event.target;
  const connection = request.result;
  let feedStore = null, entryStore = null;
  const stores = connection.objectStoreNames;

  if(stores.contains('feed')) {
    feedStore = request.transaction.objectStore('feed');
  } else {
    feedStore = connection.createObjectStore('feed', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  if(stores.contains('entry')) {
    entryStore = request.transaction.objectStore('entry');
  } else {
    entryStore = connection.createObjectStore('entry', {
      keyPath: 'id',
      autoIncrement: true
    });
  }

  const feedIndices = feedStore.indexNames;
  const entryIndices = entryStore.indexNames;

  // Deprecated
  if(feedIndices.contains('schemeless')) {
    feedStore.deleteIndex('schemeless');
  }

  // Deprecated. Use the new urls index
  if(feedIndices.contains('url')) {
    feedStore.deleteIndex('url');
  }

  // Create a multi-entry index using the new urls property, which should
  // be an array of unique strings of normalized urls
  if(!feedIndices.contains('urls')) {
    feedStore.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  }

  // TODO: deprecate this, have the caller manually sort and stop requiring
  // title, this just makes it difficult.
  if(!feedIndices.contains('title')) {
    feedStore.createIndex('title', 'title');
  }

  // Deprecated
  if(entryIndices.contains('unread')) {
    entryStore.deleteIndex('unread');
  }

  // For example, used to count the number of unread entries
  if(!entryIndices.contains('readState')) {
    entryStore.createIndex('readState', 'readState');
  }

  if(!entryIndices.contains('feed')) {
    entryStore.createIndex('feed', 'feed');
  }

  if(!entryIndices.contains('archiveState-readState')) {
    entryStore.createIndex('archiveState-readState',
      ['archiveState', 'readState']);
  }

  // Deprecated. Use the urls index instead.
  if(entryIndices.contains('link')) {
    entryStore.deleteIndex('link');
  }

  // Deprecated. Use the urls index instead.
  if(entryIndices.contains('hash')) {
    entryStore.deleteIndex('hash');
  }

  if(!entryIndices.contains('urls')) {
    entryStore.createIndex('urls', 'urls', {
      'multiEntry': true,
      'unique': true
    });
  }
};

db.openReadUnarchivedEntryCursor = function(connection, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('archiveState-readState');
  const keyPath = [db.EntryFlags.UNARCHIVED, db.EntryFlags.READ];
  const request = index.openCursor(keyPath);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.openUnreadUnarchivedEntryCursor = function(connection, callback) {
  const transaction = connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const index = entryStore.index('archiveState-readState');
  const keyPath = [db.EntryFlags.UNARCHIVED, db.EntryFlags.UNREAD];
  const request = index.openCursor(keyPath);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.openEntryCursorForFeed = function(connection, feedId, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(feedId);
  request.onsuccess = callback;
};

// NOTE: even though the count can include archived, I don't think it matters
// because I am currently assuming an entry can never be unread and archived.
db.countUnreadEntries = function(connection, callback) {
  const transaction = connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(db.EntryFlags.UNREAD);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.openFeedsCursor = function(connection, callback) {
  const transaction = connection.transaction('feed');
  const feedStore = transaction.objectStore('feed');
  const request = feedStore.openCursor();
  request.onsuccess = callback;
  request.onerror = callback;
};

// TODO: this requires feeds have a title in order to appear in the index.
// I would prefer instead to remove this requirement, load all feeds, and
// sort manually, allowing for untitled feeds. I think? Tentative.
db.openFeedsCursorSortedByTitle = function(connection, callback) {
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('title');
  const request = index.openCursor();
  request.onsuccess = callback;
};

db.findFeedById = function(connection, feedId, callback) {
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.get(feedId);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.deleteFeedById = function(connection, feedId, callback) {
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(feedId);
  request.onsuccess = callback;
};

db.getEntryById = function(connection, entryId, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const store = transaction.objectStore('entry');
  const request = store.openCursor(entryId);
  request.onsuccess = callback;
  request.onerror = callback;
};

// Expects a URL object, not a string. This will convert the url to a string
// and search with the string. Converting the url to a string will normalize
// the url, in the same way the url was normalized when storing the entry, so
// that only normalized urls are compared against each other. So, for example,
// 'http://www.domain.com/page.html' will match
// 'HTTP://WWW.DOMAIN.COM/page.html'. The second reason is that indexedDB
// cannot directly store URL objects (for an unknown reason).
db.findEntryWithURL = function(connection, url, callback) {
  const transaction = connection.transaction('entry');
  const entryStore = transaction.objectStore('entry');
  const urlsIndex = entryStore.index('urls');
  const request = urlsIndex.get(url.href);
  request.onsuccess = callback;
  request.onerror = callback;
};

// Use an isolated transaction for storing an entry. The problem with using a
// shared transaction in the case of a batch insert is that the uniqueness
// check from index constraints is db-delegated and unknown apriori without a
// separate lookup request, and that any constraint failure causes the entire
// transaction to fail.
db.addEntry = function(connection, entry, callback) {
  const transaction = connection.transaction('entry', 'readwrite');
  const entryStore = transaction.objectStore('entry');
  const request = entryStore.add(entry);
  request.onsuccess = callback;
  request.onerror = callback;
};

// Create a storable object from the input feeds by combining together the
// properties of current and new feed into a basic object, and then
// sanitizing the properties of the storable feed, and then storing the
// storable feed, and then calling the callback.
// TODO: ensure the date is not beyond the current date?
// TODO: maybe do not modify date updated if no values changed
// TODO: think more about XSS and where I should be sanitizing these inputs,
// should it be the responsibility of render, or here before storage. There is
// an ambiguity then regarding the input formatting, I don't want to mistakenly
// re-encode encoded html entities and so forth. Maybe just using textContent
// instead of innerHTML in the render will ensure no problem.
// TODO: so maybe what I should do is define Feed.merge that takes two feed
// objects and generates a third that is the result of merging the two
// TODO: also, maybe it shouldn't sanitize.
// TODO: also, this now expects Feed objects, not simple objects
// TODO: also, this now uses new fields for dates, and uses date objects
// TODO: also, this should probably pass a Feed object to the callback,
// instead of the serialized feed that was put. So I probably want to use the
// input feed and just set its id if it was an add and pass the input feed
// to the callback
// so if i shouldn't be merging in putFeed, instead I should have two functions
// again, one to add a feed, and one to update. so poll uses update, and
// subscribe and opmlimport use add
// If i do that, however, then the only place where I merge is when doing an
// update. maybe that still makes sense to be separate though.
// I think before I do this I should do the renaming and retyping of various
// fields
db.putFeed = function(connection, currentFeed, newFeed, callback) {

  // Generate a serializable object for storage and to pass to the callback
  const storable = Object.create(null);

  // Only set the id if we are doing an update. If we are doing an add, the
  // id is automatically defined by indexedDB's autoincrement feature
  // Assume that if id is defined that it is valid.
  // Assume that if currentFeed is defined that id is defined.
  if(currentFeed) {
    storable.id = currentFeed.id;
  }

  // Merge old and new urls together into an array of strings
  storable.urls = [];

  // Copy over any of the old urls
  if(currentFeed) {
    // NOTE: currentFeed is the feed loaded from the database. Its urls
    // property contains serialized URL strings
    // TODO: use push.apply or something like that
    for(let i = 0, len = currentFeed.urls.length; i < len; i++) {
      storable.urls.push(currentFeed.urls[i]);
    }
  }

  // Copy over the new URLs, maintaining order. newFeed.urls is an array of
  // URL objects
  for(let i = 0, len = newFeed.urls.length, urlString; i < len; i++) {
    urlString = newFeed.urls[i].href;
    if(storable.urls.indexOf(urlString) === -1) {
      storable.urls.push(urlString);
    }
  }

  // console.debug('Storing feed with urls', storable.urls);

  // Store the fetched feed type (e.g. rss or rdf) as a string
  // Assume that if type is defined that it is valid
  if('type' in newFeed) {
    storable.type = newFeed.type;
  }

  // NOTE: title is semi-required. It must be defined, although it can be
  // an empty string. It must be defined because of how views query and
  // iterate over the feeds in the store using title as an index. If it were
  // ever undefined those feeds would not appear in the title index.
  // TODO: remove this requirement somehow? Maybe the options page that
  // retrieves feeds has to manually sort them?
  const title = sanitizeString(newFeed.title);
  storable.title = title || '';

  const description = sanitizeString(newFeed.description);
  if(description) {
    storable.description = description;
  }

  // First copy over the existing link url string
  if(currentFeed.link) {
    storable.link = currentFeed.link;
  }

  // If defined, overwrite the prior link. newFeed.link is a URL object.
  if(newFeed.link) {
    storable.link = newFeed.link.href;
  }

  // Even though date should always be set, this can work in the absence of
  // a value
  // TODO: qualify this date better. What is it? And what type is it?
  // Look at the RSS specs again and define this clearly.
  if(newFeed.date) {
    storable.date = newFeed.date;
  }

  if(newFeed.dateFetched) {
    storable.dateFetched = newFeed.dateFetched;
  }

  // The date the feed's remote file was last modified
  if(newFeed.dateLastModified) {
    storable.dateLastModified = newFeed.dateLastModified;
  }

  // Set date created and date updated. We only modify date updated if we
  // are updating an existing feed. We don't set date updated for a new feed
  // because it has never been updated (note I am not sure if I like this).
  // TODO: use better names, like dateCreated, dateUpdated or dateModified
  // TODO: use Date objects instead of timestamps
  if(currentFeed) {
    storable.updated = Date.now();
    storable.created = currentFeed.created;
  } else {
    storable.created = Date.now();
  }

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  let request = null;

  // Some testing showed that certain indexedDB errors are thrown as a result
  // of calling store.put instead of creating events catch by request.onerror,
  // so I have to use a try catch here.

  try {
    request = store.put(storable);
  } catch(exception) {
    if(callback) {
      const exceptionEvent = Object.create(null);
      exceptionEvent.type = 'exception';
      exceptionEvent.message = exception.message;
      callback(storable, exceptionEvent);
    }
    return;
  }

  if(callback) {
    request.onsuccess = onPutSuccess;
    request.onerror = onPutError;
  }

  function onPutSuccess(event) {
    if(!storable.id) {
      storable.id = event.target.result;
    }
    callback(storable, event);
  }

  function onPutError(event) {
    callback(storable, event);
  }

  // Prep a string property of an object for storage
  function sanitizeString(inputString) {
    let outputString = inputString;
    if(inputString) {
      outputString = filterControlCharacters(outputString);
      outputString = replaceHTML(outputString, '');
      // Condense whitespace
      // TODO: maybe this should be a utils function
      outputString = outputString.replace(/\s+/, ' ');
      outputString = outputString.trim();
    }
    return outputString;
  }
};

db.addFeed = function(connection, feed, callback) {
  const transaction = connection.transaction('feed', 'readwrite');
  const feedStore = transaction.objectStore('feed');
  const request = feedStore.add(feed);
  request.onsuccess = callback;
  request.onerror = callback;
};

db.updateFeed = function(connection, feed, callback) {
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(feed);
  request.onsuccess = callback;
  request.onerror = callback;
};

// TODO: maybe deprecate and just use the clear button provided by
// the inspector
db.clearEntryStore = function(connection) {
  if(connection) {
    clearEntries(connection);
  } else {
    db.open(onOpen);
  }

  return 'Requesting entry store to be cleared.';

  function onOpen(event) {
    if(event.type !== 'success') {
      console.debug(event);
      return;
    }

    const connection = event.target.result;
    clearEntries(connection);
  }

  function clearEntries(connection) {
    const transaction = connection.transaction('entry', 'readwrite');
    transaction.oncomplete = onComplete;
    const store = transaction.objectStore('entry');
    store.clear();
  }

  function onComplete(event) {
    console.log('Cleared entry object store');
    updateBadgeUnreadCount(event.target.db);
  }
};
