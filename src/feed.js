// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Requires: /src/url.js

// Feed routines. One of the main goals is to centralize all functions that
// access or manipulate feed properties, so that if I need to make a change
// to feed properties, I can easily also change the dependent functions.



// TODO: the other idea i am considering is using a Feed function object
// instead of an object literal. It makes sense to use an object in this case
// to represent a bag of properties.

// The main issue is that I do not have a complete understanding of how
// indexedDB stores function objects due to how its structured cloning
// algorithm works. For example, is the prototype of the object stored?


function feed_find_by_id(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.get(id);
  request.onsuccess = callback;
}

function feed_find_by_url(connection, url, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const index = store.index('schemeless');
  const schemeless = url_filter_protocol(url);
  const request = index.get(schemeless);
  request.onsuccess = callback;
}

// TODO: deprecate, this is a caller responsibility
function feed_for_each(connection, handleFeed, sortByTitle, callback) {
  'use strict';

  function on_success(event) {
    const cursor = event.target.result;
    if(cursor) {
      handleFeed(cursor.value);
      cursor.continue();
    }
  }

  const transaction = connection.transaction('feed');
  transaction.oncomplete = callback;
  let store = transaction.objectStore('feed');
  if(sortByTitle) {
    store = store.index('title');
  }

  const request = store.openCursor();
  request.onsuccess = on_success;
}

// TODO: maybe deprecate, this is a caller responsibility
function feed_get_all(connection, callback) {
  'use strict';

  function on_success(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      callback(feeds);
    }
  }

  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.openCursor();
  const feeds = [];
  request.onsuccess = on_success;
}


// TODO: check last modified date of the remote xml file to avoid
// pointless updates?
// TODO: ensure the date is not beyond the current date?
// TODO: maybe not modify date updated if not dirty
// TODO: sanitize html entities?
function db_store_feed(connection, original, feed, callback) {
  'use strict';

  const storable = {};

  if(original) {
    storable.id = original.id;
  }

  storable.url = feed.url;

  if(feed.hasOwnProperty('type')) {
    storable.type = feed.type;
  }

  if(original) {
    storable.schemeless = original.schemeless;
  } else {
    storable.schemeless = url_filter_protocol(storable.url);
  }

  const title = feed_sanitize_before_store(feed.title);
  storable.title = title || '';

  const description = feed_sanitize_before_store(feed.description);
  if(description) {
    storable.description = description;
  }

  const link = feed_sanitize_before_store(feed.link);
  if(link) {
    storable.link = link;
  }

  if(feed.date) {
    storable.date = feed.date;
  }

  if(feed.fetchDate) {
    storable.fetchDate = feed.fetchDate;
  }

  if(original) {
    storable.updated = Date.now();
    storable.created = original.created;
  } else {
    storable.created = Date.now();
  }

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = function onSuccess(event) {
    const newId = event.target.result;
    callback(newId);
  };
  request.onerror = function onError(event) {
    callback();
  };
}

function feed_sanitize_before_store(value) {
  'use strict';

  if(value) {
    value = html_replace(value, '');
    value = string_filter_controls(value);
    value = value.replace(/\s+/, ' ');
    value = value.trim();
    return value;
  }
}
