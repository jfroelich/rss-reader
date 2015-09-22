// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.entry = lucu.entry || {};

lucu.entry.markRead = function(entryId, callback, fallback) {
  'use strict';
  // console.log('Marking %s as read', entryId);
  var onConnect = lucu.entry.onMarkReadConnect.bind(null, entryId, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.entry.onMarkReadConnect = function(entryId, callback, error, database) {
  'use strict';
  var transaction = database.transaction('entry', 'readwrite');
  transaction.oncomplete = callback;
  var entryStore = transaction.objectStore('entry');
  var markReadRequest = entryStore.openCursor(entryId);
  markReadRequest.onsuccess = lucu.entry.markReadUpdateEntry;
};

lucu.entry.markReadUpdateEntry = function(event) {
  'use strict';
  var cursor = event.target.result;
  if(!cursor) return;

  // Get the entry at the cursor. It may be possible that the entry somehow
  // no longer exists, so escape early when that is the case.
  var entry = cursor.value;
  if(!entry) return;

  // Suppress attempts to mark an entry as read if it is already read
  if(!entry.hasOwnProperty('unread')) {
  	// console.debug('Entry is already marked as read, suppressing');
  	return;
  }

  // Modify the entry
  delete entry.unread;
  entry.readDate = Date.now();
  cursor.update(entry);

  // console.debug('Marked %o as read', entry);

  // Update the unread count
  lucu.badge.update();

  // Notify observers that the entry was read
  // TODO: is anything listening to this? maybe deprecate?
  chrome.runtime.sendMessage({type: 'entryRead', entry: entry});
};
