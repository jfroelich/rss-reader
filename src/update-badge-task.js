// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function UpdateBadgeTask() {
  this.openDBTask = new OpenFeedDbTask();
  this.entryFlags = rdr.entry.flags;
  this.log = new LoggingService();
}

// Sets the text of the extension's badge to the current number of unread
// entries. Opens a connection if not provided.
UpdateBadgeTask.prototype.start = function(db) {
  this.log.log('Updating badge unread count');
  const ctx = {'db': db, 'text': '?'};
  if(db) {
    this._countUnread(ctx);
  } else {
    this.openDBTask.open(this._openDBOnSuccess.bind(this, ctx),
      this._openDBOnError.bind(this, ctx));
  }
};

UpdateBadgeTask.prototype._openDBOnSuccess = function(ctx, event) {
  this.log.log('Connected to database');
  ctx.db = event.target.result;
  ctx.shouldCloseDB = true;
  this._countUnread(ctx);
};

UpdateBadgeTask.prototype._openDBOnError = function(ctx, event) {
  this.log.error(event.target.error);
  this._onComplete(ctx);
};

UpdateBadgeTask.prototype._countUnread = function(ctx) {
  const tx = ctx.db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(this.entryFlags.UNREAD);
  request.onsuccess = this._countOnSuccess.bind(this, ctx);
  request.onerror = this._countOnError.bind(this, ctx);
};

UpdateBadgeTask.prototype._countOnSuccess = function(ctx, event) {
  const count = event.target.result;
  this.log.log('Counted %s unread entries', count);
  if(count > 999) {
    ctx.text = '1k+';
  } else {
    ctx.text = '' + event.target.result;
  }

  this._onComplete(ctx);
};

UpdateBadgeTask.prototype._countOnError = function(ctx, event) {
  this.log.error(event.target.error);
  this._onComplete(ctx);
};

UpdateBadgeTask.prototype._onComplete = function(ctx) {
  this.log.log('Setting badge text to', ctx.text);
  chrome.browserAction.setBadgeText({'text': ctx.text});
  if(ctx.shouldCloseDB && ctx.db) {
    this.log.log('Requesting database connection to close');
    ctx.db.close();
  }
};
