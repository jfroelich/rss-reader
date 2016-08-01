// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function addFeed(connection, feed, callback) {
  let storableFeed = Feed.prototype.serialize.call(feed);
  storableFeed = Feed.prototype.sanitize.call(storableFeed);
  storableFeed.dateCreated = new Date();

  console.debug('Caching feed', storableFeed);

  const transaction = connection.transaction('feed', 'readwrite');
  const feedStore = transaction.objectStore('feed');
  const request = feedStore.add(storableFeed);

  if(callback) {
    request.onsuccess = onAddSuccess;
    request.onerror = onAddError;
  }

  function onAddSuccess(event) {
    storableFeed.id = event.target.result;
    callback({'type': 'success', 'feed': storableFeed});
  }

  function onAddError(event) {
    console.error('Error adding feed', event);
    callback({'type': event.target.error.name});
  }
}
