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
    openDB(onOpenDB.bind(context));
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
  const request = index.count(ENTRY_FLAGS.UNREAD);
  request.onsuccess = count_onsuccess.bind(this);
  request.onerror = count_onerror.bind(this);
}

function count_onsuccess(event) {
  const count = event.target.result;
  if(count > 999) {
    this.text = '1k+';
  } else {
    this.text = '' + event.target.result;
  }

  onUpdateBadgeComplete.call(this);
}

function count_onerror(event) {
  console.error(event.target.error);
  onUpdateBadgeComplete.call(this);
}

function onUpdateBadgeComplete() {
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldCloseDB && this.db) {
    this.db.close();
  }
}

this.updateBadge = updateBadge;

} // End file scope
