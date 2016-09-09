// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

function unsubscribe(feedId, callback) {
  console.debug('Unsubscribing from', feedId);

  console.assert(feedId);
  console.assert(!isNaN(feedId));
  console.assert(isFinite(feedId));
  console.assert(feedId > 0);

  const context = {
    'connection': null,
    'feedId': feedId,
    'numDeleteEntryRequests': 0,
    'callback': callback
  };

  openDB(onOpenDB.bind(context));
}

function onOpenDB(connection) {
  if(connection) {
    this.connection = connection;
    const tx = connection.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(this.feedId);
    request.onsuccess = openEntryCursorOnSuccess.bind(this);
    request.onerror = openEntryCursorOnError.bind(this);
  } else {
    onUnsubscribeComplete.call(this, 'ConnectionError');
  }
}

function openEntryCursorOnSuccess(event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;

    // Async
    cursor.delete();
    this.numDeleteEntryRequests++;

    // Async
    chrome.runtime.sendMessage({
      'type': 'deleteEntryRequested',
      'entryId': entry.id
    });

    // Async
    cursor.continue();
  } else {
    onRemoveEntries.call(this);
  }
}

function openEntryCursorOnError(event) {
  console.error(event.target.error);
  onUnsubscribeComplete.call(this, 'DeleteEntryError');
}

function onRemoveEntries() {
  console.debug('Deleting feed', this.feedId);
  const tx = this.connection.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.delete(this.feedId);
  request.onsuccess = deleteFeedOnSuccess.bind(this);
  request.onerror = deleteFeedOnError.bind(this);
}

function deleteFeedOnSuccess(event) {
  onUnsubscribeComplete.call(this, 'success');
}

function deleteFeedOnError(event) {
  console.error(event.target.error);
  onUnsubscribeComplete.call(this, 'DeleteFeedError');
}

function onUnsubscribeComplete(eventType) {
  console.log('Unsubscribed');

  if(this.connection) {
    if(this.numDeleteEntryRequests) {
      console.debug('Requested %i entries to be deleted',
        this.numDeleteEntryRequests);
      // Even though the deletes are pending, the readonly transaction in
      // updateBadge implicitly waits for the pending deletes to complete
      updateBadge(this.connection);
    }

    this.connection.close();
  }

  if(this.callback) {
    // Has to callback using "feedId" because callers assume that property
    // name. Same thing with "deleteRequestCount"
    this.callback({
      'type': eventType,
      'feedId': this.feedId,
      'deleteRequestCount': this.numDeleteEntryRequests
    });
  }
}

this.unsubscribe = unsubscribe;

} // End file block scope
