// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// @param connection {IDBDatabase} an open database connection
// @param feed {Feed} the feed to put into the database
// @param callback {function} optional callback function
// TODO: pass back the sanitized Feed object, not the serialized feed?
function updateFeed(connection, feed, callback) {
  console.debug('Updating feed', feed.getURL().href);

  let sanitizedFeed = feed.sanitize();
  sanitizedFeed.dateUpdated = new Date();
  let serializedFeed = sanitizedFeed.serialize();

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(serializedFeed);

  if(callback) {
    request.onsuccess = onPutSuccess;
    request.onerror = onPutError;
  }

  function onPutSuccess(event) {
    callback({'type': 'success', 'feed': serializedFeed});
  }

  function onPutError(event) {
    console.error(event);
    callback({'type': 'error'});
  }
}
