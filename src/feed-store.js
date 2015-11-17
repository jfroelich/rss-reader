// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const FeedStore = {};

{ // BEGIN LEXICAL SCOPE

function findByURL(connection, url, callback) {
  const transaction = connection.transaction('feed');
  const urls = transaction.objectStore('feed').index('schemeless');
  const request = urls.get(URLUtils.getSchemeless(url));
  request.onsuccess = callback;
}

FeedStore.findByURL = findByURL;

function findById(connection, id, callback) {
  const transaction = connection.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const request = feeds.get(id);
  request.onsuccess = callback;
}

FeedStore.findById = findById;

function forEach(connection, handleFeed, sortByTitle, callback) {
  const transaction = connection.transaction('feed');
  transaction.oncomplete = callback;

  let feeds = transaction.objectStore('feed');
  if(sortByTitle) {
    feeds = feeds.index('title');
  }

  const request = feeds.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      handleFeed(cursor.value);
      cursor.continue();        
    }
  };
}

FeedStore.forEach = forEach;

// TODO: check last modified date of the remote xml file to avoid 
// pointless updates?
// TODO: ensure the date is not beyond the current date?
// TODO: maybe not modify date updated if not dirty
function put(connection, original, feed, callback) {
  const storable = {};
  if(original) {
    storable.id = original.id;
  }
  storable.url = feed.url;
  if(original) {
    storable.schemeless = original.schemeless;
  } else {
    storable.schemeless = URLUtils.getSchemeless(storable.url);
  }

  const title = sanitizeValue(feed.title);
  storable.title = title || '';

  const description = sanitizeValue(feed.description);
  if(description) {
    storable.description = description;
  }

  const link = sanitizeValue(feed.link);
  if(link) {
    storable.link = link;
  }

  if(feed.date) {
    storable.date = feed.date;
  }

  if(feed.fetched) {
    storable.fetched = feed.fetched;
  }

  if(original) {
    storable.updated = Date.now();
    storable.created = original.created;
  } else {
    storable.created = Date.now();
  }

  // TODO: just use transaction.oncomplete ?
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = function(event) {
    callback();
  };
  request.onerror = function(event) {
    console.debug('Error putting feed %s', storable.url);
    if(event.target && event.target.error) {
      console.debug(event.target.error.message);
    } else {
      console.dir(event);
    }
    callback();
  };
}

FeedStore.put = put;

// Private helper for put
// TODO: sanitize html entities?
function sanitizeValue(value) {
  if(value) {
    value = StringUtils.removeTags(value);
    value = StringUtils.stripControlCharacters(value);
    value = value.replace(/\s+/, ' ');
    value = value.trim();
    return value;
  }
}

function remove(connection, id, callback) {
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(id);
  request.onsuccess = callback;
}

FeedStore.remove = remove;

// TODO: deprecate
function unsubscribe(connection, id, callback) {
  remove(connection, id, function(event) {
    EntryStore.removeByFeed(connection, id, callback);
  });
}

FeedStore.unsubscribe = unsubscribe;

} // END LEXICAL SCOPE
