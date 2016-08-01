// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function updateFeed(connection, feed, callback) {
  let storableFeed = Feed.prototype.serialize.call(feed);
  storableFeed = Feed.prototype.sanitize.call(storableFeed);
  storableFeed.dateUpdated = new Date();

  console.debug('Updating feed', storableFeed);

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storableFeed);

  request.onsuccess = function onPutSuccess(event) {
    callback('success', storableFeed);
  };

  request.onerror = function onPutError(event) {
    console.error('Error updating feed', event);
    callback('error', storableFeed);
  };
}
