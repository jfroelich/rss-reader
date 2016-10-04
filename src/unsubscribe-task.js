// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function UnsubscribeTask() {
  this.log = new LoggingService();
  this.openDBTask = new OpenFeedDbTask();
  this.badgeTask = new UpdateBadgeTask();
}

// @param feedId {number} required, id of feed to unsubscribe from
// @param callback {function} optional
UnsubscribeTask.prototype.start = function(feedId, callback) {
  // Strongly assert here because otherwise the process completes without an
  // error but does not find a feed
  if(!Number.isInteger(feedId) || feedId < 1) {
    throw new TypeError('invalid feed id: ' + feedId);
  }

  this.log.log('Unsubscribing from', feedId);

  const ctx = {
    'feedId': feedId,
    'numDeleteEntryRequests': 0,
    'callback': callback
  };

  this.openDBTask.open(this._openDBOnSuccess.bind(this, ctx),
    this._openDBOnError.bind(this, ctx));
};

UnsubscribeTask.prototype._openDBOnSuccess = function(ctx, event) {
  ctx.db = event.target.result;
  const tx = ctx.db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const index = store.index('feed');
  const request = index.openCursor(this.feedId);
  request.onsuccess = this._openEntryCursorOnSuccess.bind(this, ctx);
  request.onerror = this._openEntryCursorOnError.bind(this, ctx);
};

UnsubscribeTask.prototype.openDBOnError = function(ctx, event) {
  this._onComplete(ctx, 'ConnectionError');
};

UnsubscribeTask.prototype._openEntryCursorOnSuccess = function(ctx, event) {
  const cursor = event.target.result;
  if(cursor) {
    const entry = cursor.value;

    // Async
    cursor.delete();
    ctx.numDeleteEntryRequests++;

    // Async
    chrome.runtime.sendMessage({
      'type': 'deleteEntryRequested',
      'entryId': entry.id
    });

    // Async
    cursor.continue();
  } else {
    this._onRemoveEntries(ctx);
  }
};

UnsubscribeTask.prototype.openEntryCursorOnError = function(ctx, event) {
  console.error(event.target.error);
  this._onComplete(ctx, 'DeleteEntryError');
};

UnsubscribeTask.prototype.onRemoveEntries = function(ctx) {
  this.log.log('Deleting feed', this.feedId);
  const tx = ctx.db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.delete(ctx.feedId);
  request.onsuccess = this._deleteFeedOnSuccess.bind(this, ctx);
  request.onerror = this._deleteFeedOnError.bind(this, ctx);
};

UnsubscribeTask.prototype.deleteFeedOnSuccess = function(ctx, event) {
  this._onComplete(ctx, 'success');
};

UnsubscribeTask.prototype.deleteFeedOnError = function(event) {
  console.error(event.target.error);
  this._onComplete(ctx, 'DeleteFeedError');
};

UnsubscribeTask.prototype._onComplete = function(ctx, eventType) {
  this.log.log('Unsubscribed');

  if(ctx.db) {
    if(ctx.numDeleteEntryRequests) {
      console.debug('Requested %i entries to be deleted',
        ctx.numDeleteEntryRequests);
      // The tx in badge update implicitly waits for the pending
      // deletes to complete
      this.badgeTask.start(ctx.db);
    }

    // The close request implicitly waits for pending txs to resolve
    ctx.db.close();
  }

  if(ctx.callback) {
    ctx.callback({
      'type': eventType,
      'feedId': ctx.feedId,
      'deleteRequestCount': ctx.numDeleteEntryRequests
    });
  }
};
