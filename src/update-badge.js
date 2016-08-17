// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file scope

this.update_badge = function(db) {
  const context = {'db': db, 'text': '?'};
  if(db) {
    count.call(context);
  } else {
    open_db(on_open_db.bind(context));
  }
};

function on_open_db(db) {
  if(db) {
    this.db = db;
    this.shouldClose = true;
    count.call(this);
  } else {
    on_complete.call(this);
  }
}

function count() {
  const transaction = this.db.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.FLAGS.UNREAD);
  request.onsuccess = count_onsuccess.bind(this);
  request.onerror = count_onerror.bind(this);
}

function count_onsuccess(event) {
  this.text = '' + event.target.result;
  on_complete.call(this);
}

function count_onerror(event) {
  console.error(event.target.error);
  on_complete.call(this);
}

function on_complete() {
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldClose && this.db) {
    this.db.close();
  }
}

} // End file scope
