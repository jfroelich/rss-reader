// See license.md

'use strict';

{

function unsubscribe(feedId, log, callback) {
  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError('invalid feed id' + feedId);
  }

  log.log('Unsubscribing from', feedId);

  const ctx = {
    'feedId': feedId,
    'numDeleteEntryRequests': 0,
    'callback': callback,
    'log': log,
    'didDeleteFeed': false
  };

  const db = new FeedDb();
  db.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.log.debug('Connected to database');
  this.conn = event.target.result;

  const tx = this.conn.transaction(['feed', 'entry'], 'readwrite');
  tx.oncomplete = onComplete.bind(this);

  this.log.debug('Deleting feed', this.feedId);
  const feedStore = tx.objectStore('feed');
  const deleteFeedRequest = feedStore.delete(this.feedId);
  deleteFeedRequest.onsuccess = deleteFeedOnSuccess.bind(this);
  deleteFeedRequest.onerror = deleteFeedOnError.bind(this);

  const entryStore = tx.objectStore('entry');
  const feedIndex = entryStore.index('feed');
  const openCursorRequest = feedIndex.openCursor(this.feedId);
  openCursorRequest.onsuccess = openEntryCursorOnSuccess.bind(this);
  openCursorRequest.onerror = openEntryCursorOnError.bind(this);
}

function openDBOnError(event) {
  onComplete.call(this);
}

function deleteFeedOnSuccess(event) {
  this.didDeleteFeed = true;
  this.log.debug('Deleted feed', this.feedId);
}

function deleteFeedOnError(event) {
  this.log.error(event.target.error);
}

function openEntryCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    this.log.debug('Deleting entry', entry.id, Entry.getURL(entry));
    cursor.delete();
    this.numDeleteEntryRequests++;
    chrome.runtime.sendMessage({'type': 'deleteEntryRequested',
      'id': entry.id});
    cursor.continue();
  }
}

function openEntryCursorOnError(event) {
  this.log.error(event.target.error);
}

function onComplete(event) {
  this.log.log('Completed unsubscribe');

  if(this.conn) {
    if(this.numDeleteEntryRequests) {
      this.log.debug('Requested %i entries to be deleted',
        this.numDeleteEntryRequests);
      updateBadge(this.conn, SilentConsole);
    }

    this.log.debug('Requesting database connection close');
    this.conn.close();
  }

  if(this.callback) {
    const type = this.didDeleteFeed ? 'success' : 'error';
    const outputEvent = {
      'type': type,
      'deleteRequestCount': this.numDeleteEntryRequests
    };
    this.log.debug('calling back with', outputEvent);
    this.callback(outputEvent);
  }
}

this.unsubscribe = unsubscribe;

}
