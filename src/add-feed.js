// See license.md

'use strict';

{

function addFeed(conn, feed, verbose, callback) {
  // Although this error is safely handled by the database, it should never
  // occur
  if('id' in feed) {
    throw new TypeError('feed has id');
  }

  const log = new LoggingService();
  log.enabled = verbose;
  log.log('Adding feed', Feed.getURL(feed));
  let storable = Feed.sanitize(feed);
  storable.dateCreated = new Date();
  storable = ReaderUtils.filterEmptyProps(storable);
  const tx = conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.add(storable);
  request.onsuccess = onSuccess.bind(null, log, feed, callback);
  request.onerror = onError.bind(null, log, feed, callback);
}

function onSuccess(log, feed, callback, event) {
  feed.id = event.target.result;
  log.debug('Added feed %s with new %s', Feed.getURL(feed), feed.id);
  callback({'type': 'success', 'feed': feed});
}

function onError(log, feed, callback, event) {
  log.error('Error adding feed', Feed.getURL(feed), event.target.error);
  callback({'type': 'error'});
}

this.addFeed = addFeed;

}
