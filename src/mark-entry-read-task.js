// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Async, mark an entry as read in storage and then callback
function MarkEntryReadTask() {
  this.log = new LoggingService();
  this.openDbTask = new OpenFeedDbTask();
  this.entryFlags = rdr.entry.flags;
  this.updateBadgeTask = new UpdateBadgeTask();
}

MarkEntryReadTask.prototype.start = function(id, callback) {
  this.log.debug('starting mark as read for entry id', id);

  if(!Number.isInteger(id) || id < 1) {
    // TODO: use the new ES6 string template feature
    throw new Error('invalid entry id: ' + id);
  }

  const ctx = {'id': id, 'callback': callback};
  this.openDbTask.open(this._openDBOnSuccess.bind(this, ctx),
    this._openDBOnError.bind(this, ctx));
};

MarkEntryReadTask.prototype._openDBOnSuccess = function(ctx, event) {
  this.log.debug('connected to database to mark entry as read');
  const db = event.target.result;

  // TODO: maybe I can just close db here, instead of putting in context
  ctx.db = db;
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(ctx.id);
  request.onsuccess = this._openCursorOnSuccess.bind(this, ctx);
  request.onerror = this._openCursorOnError.bind(this, ctx);
};

MarkEntryReadTask.prototype._openDBOnError = function(ctx, event) {
  this.log.debug(event.target.error);
  this._onComplete(ctx, 'ConnectionError');
};

MarkEntryReadTask.prototype._openCursorOnSuccess = function(ctx, event) {
  const cursor = event.target.result;
  if(!cursor) {
    this.log.error('no entry found with id', ctx.id);
    this._onComplete(ctx, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === this.entryFlags.READ) {
    this.log.error('already read entry with id', entry.id);
    this._onComplete(ctx, 'AlreadyReadError');
    return;
  }

  this.log.debug('marking entry with id %s as read', entry.id);

  entry.readState = this.entryFlags.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;
  cursor.update(entry); // async

  this.updateBadgeTask.start(this.db);// async
  this._onComplete(ctx, 'Success');
};

MarkEntryReadTask.prototype._openCursorOnError = function(ctx, event) {
  this.log.error(event.target.error);
  this._onComplete(ctx, 'CursorError');
};

MarkEntryReadTask.prototype._onComplete = function(ctx, type) {
  this.log.log('completed marking entry as read');
  if(ctx.db) {
    this.log.debug('requesting database to close');
    ctx.db.close();
  }

  if(ctx.callback) {
    this.log.debug('calling back with type', type);
    ctx.callback({'type': type});
  }
};
