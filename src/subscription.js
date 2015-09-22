// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.subscription = {};

lucu.subscription.unsubscribe = function(feedId, callback, fallback) {
  'use strict';

  var onConnect = lucu.subscription.onUnsubscribeConnect.bind(
    null, feedId, callback, fallback);

  lucu.database.connect(onConnect, fallback);
};

// Deletes the feed and its entries
lucu.subscription.onUnsubscribeConnect = function(feedId, callback, fallback, database) {
  'use strict';

  var transaction = database.transaction(['entry','feed'], 'readwrite');

  transaction.oncomplete = lucu.subscription.onUnsubscribeComplete.bind(
  	transaction, feedId, callback);
  transaction.onerror = fallback;

  // Delete the feed
  var feedStore = transaction.objectStore('feed');
  feedStore.delete(feedId);

  // Delete the feed's entries
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

lucu.subscription.onUnsubscribeComplete = function(feedId, callback, event) {
  'use strict';
  // console.log('Unsubscribed from %s', feedId);

  // TODO: send out a message notifying other views
  // of the unsubscribe. That way the slides view can
  // remove any articles.

  callback(event);
};
