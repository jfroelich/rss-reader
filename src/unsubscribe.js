// See license.md

'use strict';

{

function unsubscribe(feedId, verbose, callback) {
  const log = new LoggingService();
  log.enabled = verbose;
  // Strongly assert here because otherwise the process completes without an
  // error but does not find a feed
  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError('invalid feed id' + feedId);
  }

  log.log('Unsubscribing from', feedId);

  const ctx = {
    'feedId': feedId,
    'numDeleteEntryRequests': 0,
    'callback': callback,
    'log': log
  };

  const feedDb = new FeedDb();
  feedDb.open(openDBOnSuccess.bind(ctx), openDBOnError.bind(ctx));
}

function openDBOnSuccess(event) {
  this.conn = event.target.result;
  const tx = this.conn.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(this.feedId);
  request.onsuccess = openEntryCursorOnSuccess.bind(this);
  request.onerror = openEntryCursorOnError.bind(this);
}

function openDBOnError(event) {
  onComplete.call(this, 'ConnectionError');
}

function openEntryCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;
    cursor.delete();// async
    this.numDeleteEntryRequests++;
    chrome.runtime.sendMessage({'type': 'deleteEntryRequested',
      'entryId': entry.id});// async
    cursor.continue();// async
  } else {
    onRemoveEntries.call(this);
  }
}

function openEntryCursorOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, 'DeleteEntryError');
}

function onRemoveEntries() {
  this.log.log('Deleting feed', this.feedId);
  const tx = this.conn.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.delete(this.feedId);
  request.onsuccess = deleteFeedOnSuccess.bind(this);
  request.onerror = deleteFeedOnError.bind(this);
}

function deleteFeedOnSuccess(event) {
  onComplete.call(this, 'success');
};

function deleteFeedOnError(event) {
  this.log.error(event.target.error);
  onComplete.call(this, 'DeleteFeedError');
}

function onComplete(eventType) {
  this.log.log('Unsubscribed');

  if(this.conn) {
    if(this.numDeleteEntryRequests) {
      console.debug('Requested %i entries to be deleted',
        this.numDeleteEntryRequests);
      const verbose = false;
      updateBadge(this.conn, verbose);
    }

    this.conn.close();
  }

  if(this.callback) {
    this.callback({
      'type': eventType,
      'feedId': this.feedId,
      'deleteRequestCount': this.numDeleteEntryRequests
    });
  }
}

this.unsubscribe = unsubscribe;

}
