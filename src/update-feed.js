// See license.md

'use strict';

{

function updateFeed(conn, feed, verbose, callback) {
  const log = new LoggingService();
  log.enabled = verbose;

  if(!('id' in feed)) {
    throw new TypeError('missing id');
  }

  log.log('Updating feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateUpdated = new Date();
  storable = ReaderUtils.filterEmptyProps(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(storable);
  request.onsuccess = onSuccess.bind(null, log, storable, callback);
  request.onerror = onError.bind(null, log, storable, callback);
}

function onSuccess(log, feed, callback, event) {
  log.debug('Updated feed', Feed.getURL(feed));
  if(callback) {
    callback({'type': 'success', 'feed': feed});
  }
}

function onError(log, feed, callback, event) {
  log.error('Error updating feed', Feed.getURL(feed), event.target.error);
  if(callback) {
    callback({'type': 'error', 'feed': feed});
  }
}

this.updateFeed = updateFeed;

}
