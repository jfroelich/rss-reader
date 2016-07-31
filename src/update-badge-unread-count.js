// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function updateBadgeUnreadCount(callback) {
  console.debug('Updating badge unread count');
  const cache = new FeedCache();
  cache.open(updateBadgeUnreadCountOnOpenDatabase.bind(this, callback));
}

function updateBadgeUnreadCountOnOpenDatabase(callback, connection) {
  if(connection) {
    const transaction = connection.transaction('entry');
    const store = transaction.objectStore('entry');
    const index = store.index('readState');
    const request = index.count(Entry.FLAGS.UNREAD);
    request.onsuccess = updateBadgeUnreadCountOnSuccess.bind(request, callback);
    request.onerror = updateBadgeUnreadCountOnError.bind(request, callback);
    connection.close();
  } else {
    chrome.browserAction.setBadgeText({'text': '?'});
    updateBadgeUnreadCountOnComplete(callback);
  }
}

function updateBadgeUnreadCountOnSuccess(callback, event) {
  chrome.browserAction.setBadgeText({'text': '' + event.target.result});
  updateBadgeUnreadCountOnComplete(callback);
}

function updateBadgeUnreadCountOnError(callback, event) {
  console.error('Error counting unread entries', event);
  chrome.browserAction.setBadgeText({'text': '?'});
  updateBadgeUnreadCountOnComplete(callback);
}

function updateBadgeUnreadCountOnComplete(callback) {
  // Callback is optional
  if(callback) {
    callback();
  }
}
