// See license.md

'use strict';

{

function getAllFeeds(conn, verbose, callback) {
  const log = new LoggingService();
  log.enabled = verbose;
  log.log('Getting all feeds from database');
  const ctx = {'callback': callback, 'feeds': [], 'log': log};
  const tx = conn.transaction('feed');
  tx.oncomplete = onComplete.bind(ctx);
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = openCursorOnSuccess.bind(ctx);
  request.onerror = openCursorOnError.bind(ctx);
}

function openCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    const feed = cursor.value;
    this.log.debug('Appending feed', Feed.getURL(feed));
    this.feeds.push(feed);
    cursor.continue();
  }
}

function openCursorOnError(event) {
  this.log.error(event.target.error);
}

function onComplete(event) {
  this.log.log('Completed getting all feeds');
  this.callback(this.feeds);
}

this.getAllFeeds = getAllFeeds;

}
