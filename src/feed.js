// Copyright 2015 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// TODO: somehow store responseURL? 
// TODO: intelligently react to redirects
function fetchFeed(url, timeout, callback) {
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = function(event) {
    const document = event.target.responseXML;
    if(!document || !document.documentElement) {
      callback(event);
      return;
    }

    try {
      const feed = deserializeFeed(document);
      feed.url = url;
      feed.fetched = Date.now();
      feed.entries = feed.entries.filter(function(entry) {
        return entry.link;
      });
      feed.entries.forEach(function(entry) {
        entry.link = URLUtils.rewrite(entry.link);
      });
      feed.entries = ArrayUtils.unique(feed.entries);
      callback(null, feed);
    } catch(exception) {
      callback(exception);
    }    
  };
  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();
}

function findFeedByURL(connection, url, callback) {
  const transaction = connection.transaction('feed');
  const urls = transaction.objectStore('feed').index('schemeless');
  const request = urls.get(URLUtils.getSchemeless(url));
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
}

function findFeedById(connection, id, callback) {
  const transaction = connection.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const request = feeds.get(id);
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
}

function forEachFeed(connection, handleFeed, sortByTitle, callback) {
  const transaction = connection.transaction('feed');
  transaction.oncomplete = callback;

  let feeds = transaction.objectStore('feed');
  if(sortByTitle) {
    feeds = feeds.index('title');
  }

  const request = feeds.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(!cursor) return;
    handleFeed(cursor.value);
    cursor.continue();
  };
}

// TODO: check last modified date of the remote xml file to avoid 
// pointless updates?
// TODO: ensure the date is not beyond the current date?
// TODO: stop requiring title (fix the options page issue)
// TODO: maybe not modify date updated if not dirty
function putFeed(connection, original, feed, callback) {
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

  const title = sanitizeFeedValue(feed.title);
  storable.title = title || '';

  const description = sanitizeFeedValue(feed.description);
  if(description) {
    storable.description = description;
  }

  const link = sanitizeFeedValue(feed.link);
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
    console.debug('Error putting feed %s', JSON.stringify(storable));
    console.dir(event);
    callback();
  };
}

// TODO: sanitize html entities?
function sanitizeFeedValue(value) {
  if(value) {
    value = StringUtils.removeTags(value);
    value = StringUtils.stripControlCharacters(value);
    value = value.replace(/\s+/, ' ');
    value = value.trim();
    return value;
  }
}

function removeFeed(connection, id, callback) {
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(id);
  request.onsuccess = callback;
}

// TODO: deprecate
function unsubscribe(connection, id, callback) {
  removeFeed(connection, id, function(event) {
    removeEntriesByFeed(connection, id, callback);
  });
}
