// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Sets the badge text to a count of unread entries, which
 * may be the value of 0.
 */
function updateBadge() {
  lucu.database.open(onConnectCountUnreadToUpdateBadge);
}

function onConnectCountUnreadToUpdateBadge(db) {
  var transactionEntry = db.transaction('entry');
  var storeEntry = transactionEntry.objectStore('entry');
  var indexUnread = storeEntry.index('unread');
  var requestCount = indexUnread.count();
  requestCount.onsuccess = onUnreadCountUpdateBadge;
}

function onUnreadCountUpdateBadge() {
  // For the moment this intentionally does not set an upper bound
  // (if count > 999 then '999+' else count.tostring)
  var count = this.result || 0;
  chrome.browserAction.setBadgeText({text: count.toString()});
}

function showNotification(message) {
  chrome.permissions.contains({permissions: ['notifications']},
    showNotificationIfPermitted.bind(null, message));
}

function showNotificationIfPermitted(message, permitted) {
  if(!permitted)
    return;

  var title = chrome.runtime.getManifest().name || 'Untitled';

  chrome.notifications.create('honeybadger', {
    type: 'basic',
    title: title,
    iconUrl: '/media/rss_icon_trans.gif',
    message: message
  }, lucu.functionUtils.noop);
}
