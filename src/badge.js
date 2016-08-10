// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const badge = {};

// Sets the text of the extension's icon in the extension toolbar to the number
// of unread entries in the database.
badge.update = function(connection) {

  // Create a custom context for simpler passing of parameters to continuations
  const context = {
    'shouldClose': !connection,
    'connection': connection,
    'text': '?'
  };

  if(connection) {
    badge.countUnread.call(context);
  } else {
    openIndexedDB(badge.onOpenDatabase.bind(context));
  }
};

badge.onOpenDatabase = function(connection) {
  if(connection) {
    this.connection = connection;
    badge.countUnread.call(this);
  } else {
    badge.onComplete.call(this);
  }
};

badge.countUnread = function() {
  const transaction = this.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.FLAGS.UNREAD);
  request.onsuccess = badge.countOnSuccess.bind(this);
  request.onerror = badge.countOnError.bind(this);
};

badge.countOnSuccess = function(event) {
  this.text = '' + event.target.result;
  badge.onComplete.call(this);
};

badge.countOnError = function(event) {
  console.error(event);
  badge.onComplete.call(this);
};

badge.onComplete = function() {
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldClose && this.connection) {
    this.connection.close();
  }
};
