// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function BadgeUpdateService() {
  this.dbService = new FeedDbService();
  this.entryFlags = rdr.entry.flags;
  this.verbose = false;
}

// Sets the text of the extension's badge to the current number of unread
// entries. Opens a connection if not provided.
BadgeUpdateService.prototype.start = function(db) {

  if(this.verbose) {
    console.log('Updating badge unread count');
  }

  const ctx = {'db': db, 'text': '?'};
  if(db) {
    this._countUnread(ctx);
  } else {
    this.dbService.open(this._openDBOnSuccess.bind(this, ctx),
      this._openDBOnError.bind(this, ctx));
  }
};

BadgeUpdateService.prototype._openDBOnSuccess = function(ctx, event) {
  if(this.verbose) {
    console.log('Connected to database');
  }
  ctx.db = event.target.result;
  ctx.shouldCloseDB = true;
  this._countUnread(ctx);
};

BadgeUpdateService.prototype._openDBOnError = function(ctx, event) {
  if(this.verbose) {
    console.error(event.target.error);
  }
  this._onComplete(ctx);
};

BadgeUpdateService.prototype._countUnread = function(ctx) {
  const tx = ctx.db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(this.entryFlags.UNREAD);
  request.onsuccess = this._countOnSuccess.bind(this, ctx);
  request.onerror = this._countOnError.bind(this, ctx);
};

BadgeUpdateService.prototype._countOnSuccess = function(ctx, event) {
  const count = event.target.result;

  if(this.verbose) {
    console.log('Counted %s unread entries', count);
  }

  if(count > 999) {
    ctx.text = '1k+';
  } else {
    ctx.text = '' + event.target.result;
  }

  this._onComplete(ctx);
};

BadgeUpdateService.prototype._countOnError = function(ctx, event) {
  if(this.verbose) {
    console.error(event.target.error);
  }

  this._onComplete(ctx);
};

BadgeUpdateService.prototype._onComplete = function(ctx) {

  if(this.verbose) {
    console.log('Setting badge text to', ctx.text);
  }

  chrome.browserAction.setBadgeText({'text': ctx.text});
  if(ctx.shouldCloseDB && ctx.db) {
    if(this.verbose) {
      console.log('Requesting database connection to close');
    }
    ctx.db.close();
  }
};
