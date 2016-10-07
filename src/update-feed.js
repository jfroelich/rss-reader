// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{

// Store an updated feed object in the db then callback
function updateFeed(db, feed, callback) {

  // TODO: new issue, is how do I ever turn on the logging service?
  // In test context I would have to stub LoggingService which seems silly
  // I could add verbose flag but then that's redundant with log.enabled?

  const $this = this || {};
  const $LoggingService = $this.LoggingService || LoggingService;
  const $Feed = $this.Feed || Feed;
  const $ReaderUtils = $this.ReaderUtils || ReaderUtils;

  // store.put would add otherwise
  if(!('id' in feed)) {
    throw new Error('missing id');
  }

  const log = new $LoggingService();

  // If I add a verbose param, I would use it like this
  // log.enabled = verbose;

  log.log('Updating feed', $Feed.getURL(feed));
  let storable = $Feed.sanitize(feed);
  storable.dateUpdated = new Date();
  storable = $ReaderUtils.filterEmptyProps(storable);
  const tx = db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = onSuccess.bind(null, $Feed, log, storable, callback);
  request.onerror = onError.bind(null, $Feed, log, storable, callback);
}

function onSuccess($Feed, log, feed, callback, event) {
  log.debug('Updated feed', $Feed.getURL(feed));
  if(callback) {
    callback({'type': 'success', 'feed': feed});
  }
}

function onError($Feed, log, feed, callback, event) {
  log.error('Error updating feed', $Feed.getURL(feed), event.target.error);
  if(callback) {
    callback({'type': 'error', 'feed': feed});
  }
}

this.updateFeed = updateFeed;

}
