// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file scope

function updateBadge(db) {
  const context = {'db': db, 'text': '?'};
  if(db) {
    countUnreadEntries.call(context);
  } else {
    rdr.openDB(onOpenDB.bind(context));
  }
}

function onOpenDB(db) {
  if(db) {
    this.db = db;
    this.shouldCloseDB = true;
    countUnreadEntries.call(this);
  } else {
    onUpdateBadgeComplete.call(this);
  }
}

function countUnreadEntries() {
  const tx = this.db.transaction('entry');
  const store = tx.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(rdr.entry.flags.UNREAD);
  request.onsuccess = countOnSuccess.bind(this);
  request.onerror = countOnError.bind(this);
}

function countOnSuccess(event) {
  const count = event.target.result;
  if(count > 999) {
    this.text = '1k+';
  } else {
    this.text = '' + event.target.result;
  }

  onUpdateBadgeComplete.call(this);
}

function countOnError(event) {
  console.error(event.target.error);
  onUpdateBadgeComplete.call(this);
}

function onUpdateBadgeComplete() {
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldCloseDB && this.db) {
    this.db.close();
  }
}

var rdr = rdr || {};
rdr.updateBadge = updateBadge;

} // End file scope
