// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Sets the text of the extension's icon in the extension toolbar to the number
// of unread entries in the database.
function updateBadgeUnreadCount(connection) {
  const context = {
    'shouldClose': !connection,
    'connection': connection,
    'text': '?'
  };

  if(connection) {
    updateBadgeUnreadCountCountUnread.call(context);
  } else {
    openIndexedDB(updateBadgeUnreadCountOnOpenDatabase.bind(context));
  }
}

function updateBadgeUnreadCountOnOpenDatabase(connection) {
  if(connection) {
    this.connection = connection;
    updateBadgeUnreadCountCountUnread.call(this);
  } else {
    updateBadgeUnreadCountOnComplete.call(this);
  }
}

function updateBadgeUnreadCountCountUnread() {
  const transaction = this.connection.transaction('entry');
  const store = transaction.objectStore('entry');
  const index = store.index('readState');
  const request = index.count(Entry.FLAGS.UNREAD);
  request.onsuccess = updateBadgeUnreadCountOnSuccess.bind(this);
  request.onerror = updateBadgeUnreadCountOnError.bind(this);
}

function updateBadgeUnreadCountOnSuccess(event) {
  // console.debug('count result', event.target.result);
  this.text = '' + event.target.result;
  updateBadgeUnreadCountOnComplete.call(this);
}

function updateBadgeUnreadCountOnError(event) {
  console.error(event);
  updateBadgeUnreadCountOnComplete.call(this);
}

function updateBadgeUnreadCountOnComplete() {
  // console.debug('Updating badge unread count to', this.text);
  chrome.browserAction.setBadgeText({'text': this.text});
  if(this.shouldClose && this.connection) {
    this.connection.close();
  }
}
