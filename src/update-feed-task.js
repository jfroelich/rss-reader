// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

function updateFeed(db, feed, callback, deps) {

  // this is buggy
/*
  deps = deps || {};


  const LoggingService = deps.LoggingService || LoggingService;
  const Feed = deps.Feed || Feed;
  const ReaderUtils = deps.ReaderUtils || ReaderUtils;

  if(!LoggingService || !Feed || !ReaderUtils) {
    throw new Error('missing deps');
  }

*/

  // worth guarding to avoid accidentally adding
  if(!('id' in feed)) {
    throw new Error('missing id');
  }

  const log = new LoggingService();
  log.enabled = true; // temporary
  log.log('Updating feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateUpdated = new Date();
  storable = ReaderUtils.filterEmptyProps(storable);
  const tx = db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = onSuccess.bind(null, Feed, log, storable, callback);
  request.onerror = onError.bind(null, Feed, log, storable, callback);
}

function onSuccess(Feed, log, feed, callback, event) {
  log.debug('Stored feed', Feed.getURL(feed));
  if(callback) {
    callback({'type': 'success', 'feed': feed});
  }
}

function onError(Feed, log, feed, callback, event) {
  log.error('Error storing feed', Feed.getURL(feed), event.target.error);
  if(callback) {
    callback({'type': 'error', 'feed': feed});
  }
}

this.updateFeed = updateFeed;

}
