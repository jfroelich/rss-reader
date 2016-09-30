// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.entry = rdr.entry || {};
rdr.entry.mark = {};

// Async, mark an entry as read in storage and then callback
rdr.entry.mark.start = function(id, callback) {
  if(!Number.isInteger(id) || id < 1) {
    // TODO: use the new ES6 string template feature
    throw new Error('invalid entry id: ' + id);
  }

  const ctx = {'id': id, 'callback': callback};
  const dbService = new FeedDbService();
  dbService.open(rdr.entry.mark._openDBOnSuccess.bind(ctx),
    rdr.entry.mark._openDBOnError.bind(ctx));
};

rdr.entry.mark._openDBOnSuccess = function(event) {
  const db = event.target.result;
  this.db = db;
  const tx = db.transaction('entry', 'readwrite');
  const store = tx.objectStore('entry');
  const request = store.openCursor(this.id);
  request.onsuccess = rdr.entry.mark._openCursorOnSuccess.bind(this);
  request.onerror = rdr.entry.mark._openCursorOnError.bind(this);
};

rdr.entry.mark._openDBOnError = function(event) {
  rdr.entry.mark._onComplete.call(this, 'ConnectionError');
};

rdr.entry.mark._openCursorOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    console.error('No entry found', this.id);
    rdr.entry.mark._onComplete.call(this, 'NotFoundError');
    return;
  }

  const entry = cursor.value;
  if(entry.readState === rdr.entry.flags.READ) {
    console.error('Already read entry', this.id);
    rdr.entry.mark._onComplete.call(this, 'AlreadyReadError');
    return;
  }

  entry.readState = rdr.entry.flags.READ;
  const dateNow = new Date();
  entry.dateRead = dateNow;
  entry.dateUpdated = dateNow;
  cursor.update(entry); // async
  rdr.badge.update.start(this.db);// async
  rdr.entry.mark._onComplete.call(this, 'Success');
};

rdr.entry.mark._openCursorOnError = function(event) {
  console.error(event.target.error);
  rdr.entry.mark._onComplete.call(this, 'CursorError');
};

rdr.entry.mark._onComplete = function(type) {
  if(this.db) {
    this.db.close();
  }

  if(this.callback) {
    this.callback({'type': type});
  }
};
