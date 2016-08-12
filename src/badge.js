// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

const Badge = {};

// Sets the text of the extension's icon in the extension toolbar to the number
// of unread entries in the database.
Badge.update = function(connection) {

  // Create a custom context for simpler passing of parameters to continuations
  const context = {
    'shouldClose': !connection,
    'connection': connection,
    'text': '?'
  };

  if(connection) {
    Badge.countUnread.call(context);
  } else {
    Database.open(Badge.onOpenDatabase.bind(context));
  }
};

Badge.onOpenDatabase = function(connection) {
  if(connection) {
    this.connection = connection;
    Badge.countUnread.call(this);
  } else {
    Badge.onComplete.call(this);
  }
};

Badge.countUnread = function() {
  const transaction = this.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.FLAGS.UNREAD);
  request.onsuccess = Badge.countOnSuccess.bind(this);
  request.onerror = Badge.countOnError.bind(this);
};

Badge.countOnSuccess = function(event) {
  this.text = '' + event.target.result;
  Badge.onComplete.call(this);
};

Badge.countOnError = function(event) {
  console.error(event);
  Badge.onComplete.call(this);
};

Badge.onComplete = function() {
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldClose && this.connection) {
    this.connection.close();
  }
};
