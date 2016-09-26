// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.feed = rdr.feed || {};
rdr.feed.unsubscribe = {};

// TODO: add verbose parameter

rdr.feed.unsubscribe.start = function(feedId, callback) {
  console.debug('Unsubscribing from', feedId);

  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError('invalid feed id: ' + feedId);
  }

  const ctx = {
    'feedId': feedId,
    'numDeleteEntryRequests': 0,
    'callback': callback
  };

  rdr.db.open(rdr.feed.unsubscribe.onOpenDB.bind(ctx));
};

rdr.feed.unsubscribe.onOpenDB = function(db) {
  if(db) {
    this.db = db;
    const tx = db.transaction('entry', 'readwrite');
    const store = tx.objectStore('entry');
    const index = store.index('feed');
    const request = index.openCursor(this.feedId);
    request.onsuccess = rdr.feed.unsubscribe.openEntryCursorOnSuccess.bind(
      this);
    request.onerror = rdr.feed.unsubscribe.openEntryCursorOnError.bind(this);
  } else {
    rdr.feed.unsubscribe.onComplete.call(this, 'ConnectionError');
  }
};

rdr.feed.unsubscribe.openEntryCursorOnSuccess = function(event) {
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
    rdr.feed.unsubscribe.onRemoveEntries.call(this);
  }
};

rdr.feed.unsubscribe.openEntryCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.feed.unsubscribe.onComplete.call(this, 'DeleteEntryError');
};

rdr.feed.unsubscribe.onRemoveEntries = function() {
  console.debug('Deleting feed', this.feedId);
  const tx = this.db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.delete(this.feedId);
  request.onsuccess = rdr.feed.unsubscribe.deleteFeedOnSuccess.bind(this);
  request.onerror = rdr.feed.unsubscribe.deleteFeedOnError.bind(this);
};

rdr.feed.unsubscribe.deleteFeedOnSuccess = function(event) {
  rdr.feed.unsubscribe.onComplete.call(this, 'success');
};

rdr.feed.unsubscribe.deleteFeedOnError = function(event) {
  console.error(event.target.error);
  rdr.feed.unsubscribe.onComplete.call(this, 'DeleteFeedError');
};

rdr.feed.unsubscribe.onComplete = function(eventType) {
  console.log('Unsubscribed');

  if(this.db) {
    if(this.numDeleteEntryRequests) {
      console.debug('Requested %i entries to be deleted',
        this.numDeleteEntryRequests);
      // Even though the deletes are pending, the readonly transaction in
      // rdr.badge.update.start implicitly waits for the pending deletes to complete
      rdr.badge.update.start(this.db);
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
};
