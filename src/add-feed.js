// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

function addFeed(db, feed, callback) {
  const $this = this || {};
  const $LoggingService = $this.LoggingService || LoggingService;
  const $Feed = $this.Feed || Feed;
  const $ReaderUtils = $this.ReaderUtils || ReaderUtils;

  const log = new $LoggingService();

  if('id' in feed) {
    throw new Error('should never have id property');
  }

  log.log('Adding feed', $Feed.getURL(feed));
  let storable = $Feed.sanitize(feed);
  storable.dateCreated = new Date();
  storable = $ReaderUtils.filterEmptyProps(storable);
  const transaction = db.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = onSuccess.bind(null, $Feed, log, feed, callback);
  request.onerror = onError.bind(null, $Feed, log, feed, callback);
}

function onSuccess($Feed, log, feed, callback, event) {
  log.debug('Added feed', $Feed.getURL(feed));
  // Grab the auto-incremented id
  feed.id = event.target.result;
  log.debug('New feed id', feed.id);
  callback({'type': 'success', 'feed': feed});
}

function onError($Feed, log, feed, callback, event) {
  log.error('Error adding feed', $Feed.getURL(feed), event.target.error);
  callback({'type': 'error'});
}


this.addFeed = addFeed;

}
