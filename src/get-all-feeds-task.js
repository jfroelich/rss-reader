// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Gets all feeds from the feed store
function GetAllFeedsTask() {
  this.log = new LoggingService();
}

// @param db {IDBDatabase} open database connection
// @param callback {function} called with array of feeds
GetAllFeedsTask.prototype.start = function(db, callback) {
  this.log.log('Getting all feeds from database');
  const ctx = {'callback': callback, 'feeds': []};
  const tx = db.transaction('feed');
  tx.oncomplete = this._onComplete.bind(this, ctx);
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = this._openCursorOnSuccess.bind(this, ctx);
  request.onerror = this._openCursorOnError.bind(this, ctx);
};

GetAllFeedsTask.prototype._openCursorOnSuccess = function(ctx, event) {
  const cursor = event.target.result;
  if(cursor) {
    this.log.debug('Appending feed');
    ctx.feeds.push(cursor.value);
    cursor.continue();
  }
};

GetAllFeedsTask.prototype._openCursorOnError = function(ctx, event) {
  this.log.error(event.target.error);
};

GetAllFeedsTask.prototype._onComplete = function(ctx) {
  this.log.log('Completed getting all feeds');
  if('didCallback' in ctx) {
    throw new Error('already completed');
  }

  ctx.didCallback = 1;
  ctx.callback(ctx.feeds);
};
