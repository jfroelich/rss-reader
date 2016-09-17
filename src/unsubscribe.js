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
    'db': null,
    'feedId': feedId,
    'numDeleteEntryRequests': 0,
    'callback': callback
  };

  rdr.openDB(onOpenDB.bind(context));
}

function onOpenDB(db) {
  if(db) {
    this.db = db;
    const tx = db.transaction('entry', 'readwrite');
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
  const tx = this.db.transaction('feed', 'readwrite');
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

  if(this.db) {
    if(this.numDeleteEntryRequests) {
      console.debug('Requested %i entries to be deleted',
        this.numDeleteEntryRequests);
      // Even though the deletes are pending, the readonly transaction in
      // rdr.updateBadge implicitly waits for the pending deletes to complete
      rdr.updateBadge(this.db);
    }

    this.db.close();
  }

  if(this.callback) {
    this.callback({
      'type': eventType,
      'feedId': this.feedId,
      'deleteRequestCount': this.numDeleteEntryRequests
    });
  }
}

var rdr = rdr || {};
rdr.unsubscribe = unsubscribe;

} // End file block scope
