// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.badge = rdr.badge || {};
rdr.badge.update = {};

// Sets the text of the extension's badge to the current number of unread
// entries
// @param db {IDBDatabase} optional, an open database connection
rdr.badge.update.start = function(db) {
  const context = {'db': db, 'text': '?'};
  if(db) {
    rdr.badge.update._countUnread.call(context);
  } else {
    const dbService = new FeedDbService();
    dbService.open(
      rdr.badge.update._openDBOnSuccess.bind(context),
      rdr.badge.update._openDBOnError.bind(context));
  }
};

rdr.badge.update._openDBOnSuccess = function(event) {
  this.db = event.target.result;
  this.shouldCloseDB = true;
  rdr.badge.update._countUnread.call(this);
};

rdr.badge.update._openDBOnError = function(event) {
  rdr.badge.update._onComplete.call(this);
};

rdr.badge.update._countUnread = function() {
  const tx = this.db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(rdr.entry.flags.UNREAD);
  request.onsuccess = rdr.badge.update._countOnSuccess.bind(this);
  request.onerror = rdr.badge.update._countOnError.bind(this);
};

rdr.badge.update._countOnSuccess = function(event) {
  const count = event.target.result;
  if(count > 999) {
    this.text = '1k+';
  } else {
    this.text = '' + event.target.result;
  }

  rdr.badge.update._onComplete.call(this);
};

rdr.badge.update._countOnError = function(event) {
  console.error(event.target.error);
  rdr.badge.update._onComplete.call(this);
};

rdr.badge.update._onComplete = function() {
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldCloseDB && this.db) {
    this.db.close();
  }
};
