// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Sets the text of the extension's icon in the extension toolbar to the number
// of unread entries in the database.
function updateBadgeUnreadCount(connection) {
  if(connection) {
    const shouldClose = false;
    updateBadgeUnreadCountOnOpenDatabase(shouldClose, connection);
  } else {
    const shouldClose = true;
    openIndexedDB(updateBadgeUnreadCountOnOpenDatabase.bind(null, shouldClose));
  }
}

function updateBadgeUnreadCountOnOpenDatabase(shouldClose, connection) {
  if(connection) {
    // Count the number of unread entries
    const transaction = connection.transaction('entry');
    const store = transaction.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.FLAGS.UNREAD);
    request.onsuccess = updateBadgeUnreadCountOnSuccess;
    request.onerror = updateBadgeUnreadCountOnError;
    if(shouldClose) {
      connection.close();
    }
  } else {
    chrome.browserAction.setBadgeText({'text': '?'});
    updateBadgeUnreadCountOnComplete();
  }
}

function updateBadgeUnreadCountOnSuccess(event) {
  console.debug('Updating badge unread count to', event.target.result);
  chrome.browserAction.setBadgeText({'text': '' + event.target.result});
  updateBadgeUnreadCountOnComplete();
}

function updateBadgeUnreadCountOnError(event) {
  console.error('Error counting unread entries', event);
  chrome.browserAction.setBadgeText({'text': '?'});
  updateBadgeUnreadCountOnComplete();
}

function updateBadgeUnreadCountOnComplete() {

}
