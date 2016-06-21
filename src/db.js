// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: now that I think about it, I should move all database related
// functionality back here, regardless of what it does. That way, any time the
// database changes, I only have one place to update, which is the single
// responsibility principle. However, what is the reason to change? What is
// going to change?

const db = Object.create(null);

db.EntryFlags = {
  UNREAD: 0,
  READ: 1,
  UNARCHIVED: 0,
  ARCHIVED: 1
};

db.open = function(callback) {
  const DB_NAME = 'reader';
  const DB_VERSION = 20;

  const request = indexedDB.open(DB_NAME, DB_VERSION);
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
  const title = sanitizeBeforePut(newFeed.title);
  storable.title = title || '';

  const description = sanitizeBeforePut(newFeed.description);
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
  function sanitizeBeforePut(inputString) {
    let outputString = inputString;
    if(inputString) {
      outputString = utils.string.filterControlCharacters(outputString);
      outputString = replaceHTML(outputString, '');
      // Condense whitespace
      // TODO: maybe this should be a utils function
      outputString = outputString.replace(/\s+/, ' ');
      outputString = outputString.trim();
    }
    return outputString;
  }
};

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
    utils.updateBadgeUnreadCount(event.target.db);
  }
};
