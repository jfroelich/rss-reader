// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.extension = {};

/**
 * Sets the badge text to a count of unread entries, which
 * may be the value of 0.
 */
lucu.extension.updateBadge = function() {
  lucu.database.open(lucu.extension.countUnread);
};

// Private helper
lucu.extension.countUnread = function(db) {
  var transactionEntry = db.transaction('entry');
  var storeEntry = transactionEntry.objectStore('entry');
  var indexUnread = storeEntry.index('unread');
  var requestCount = indexUnread.count();
  requestCount.onsuccess = lucu.extension.setBadgeText;
};

// Private helper
lucu.extension.setBadgeText = function() {

  // Expects this instanceof IDBRequest

  // For the moment this intentionally does not set an upper bound
  // (if count > 999 then '999+' else count.tostring)
  var count = this.result || 0;
  chrome.browserAction.setBadgeText({text: count.toString()});
};

lucu.extension.showNotification = function(message) {
  chrome.permissions.contains({permissions: ['notifications']},
    lucu.extension.notifyIfPermitted.bind(null, message));
};

lucu.extension.notifyIfPermitted = function(message, permitted) {
  if(!permitted)
    return;

  var noteId = 'honeybadger';
  var cb = lucu.noop;
  var title = chrome.runtime.getManifest().name || 'Untitled';

  var note = {};
  note.type = 'basic';
  note.title = title;
  note.iconUrl = '/media/rss_icon_trans.gif';
  note.message = message;
  chrome.notifications.create(noteId, note, cb);
};
