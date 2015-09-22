// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.subscription = {};

lucu.subscription.unsubscribe = function(feedId, callback, fallback) {
  'use strict';

  var conn = lucu.db.connect();
  //var request = indexedDB.open(lucu.db.NAME, lucu.db.VERSION);
  conn.onerror = fallback;
  conn.onblocked = fallback;
  conn.onsuccess = lucu.subscription.onUnsubscribeConnect.bind(
  	null, feedId, callback, fallback);
};

// Deletes the feed and its entries
lucu.subscription.onUnsubscribeConnect = function(feedId, callback, fallback, event) {
  'use strict';
  var database = event.target.result;
  var transaction = database.transaction(['entry','feed'], 'readwrite');
  var feedStore = transaction.objectStore('feed');
  transaction.onerror = fallback;
  transaction.oncomplete = callback;

  feedStore.delete(feedId);

  var entryStore = transaction.objectStore('entry');
  var feedIndex = entryStore.index('feed');
  var entryRequest = feedIndex.openCursor(feedId);
  entryRequest.onsuccess = lucu.subscription.unsubscribeEntry;
};

lucu.subscription.unsubscribeEntry = function(event) {
  'use strict';
  var cursor = event.target.result;
  if(!cursor) return;
  cursor.delete();
  cursor.continue();
};
