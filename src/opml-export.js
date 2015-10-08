// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = lucu.opml || {};

/**
 * Creates a BLOB object and passes it to onComplete
 */
lucu.opml.export = function(onComplete) {
  'use strict';

  const waterfall = [
    lucu.opml.exportConnect,
    lucu.opml.exportGetFeeds,
    lucu.opml.exportSerialize
  ];

  const completed = lucu.opml.exportCompleted.bind(null, onComplete);
  async.waterfall(waterfall, completed);
};

lucu.opml.exportConnect = function(callback) {
  'use strict';

  const onConnect = lucu.opml.exportOnConnect.bind(null, callback);
  lucu.database.connect(onConnect, callback);
};

lucu.opml.exportOnConnect = function(callback, error, database) {
  'use strict';
  callback(null, database);
};

lucu.opml.exportGetFeeds = function(database, callback) {
  'use strict';
  const transaction = database.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.openCursor();
  const feeds = [];
  const onTransactionComplete = lucu.opml.exportGetFeedsTransactionComplete.bind(
    transaction, callback, feeds);
  transaction.oncomplete = onTransactionComplete;
  const onsuccess = lucu.opml.exportGetFeedsOnSuccess.bind(request, feeds);
  request.onsuccess = onsuccess;
};

lucu.opml.exportGetFeedsTransactionComplete = function(callback, feeds, event) {
  'use strict';
  callback(null, feeds);
};

lucu.opml.exportGetFeedsOnSuccess = function(feeds, event) {
  'use strict';
  const cursor = event.target.result;
  if(!cursor) return;
  feeds.push(cursor.value);
  cursor.continue();
};

// TODO: the default file name should be a parameter
lucu.opml.exportSerialize = function(feeds, callback) {
  'use strict';
  const document = lucu.opml.createDocument(feeds, 'subscriptions.xml');
  const xs = new XMLSerializer();
  const opml = xs.serializeToString(document);
  callback(null, opml);
};

lucu.opml.exportCompleted = function(callback, error, opmlString) {
  'use strict';
  const blob = new Blob([opmlString], {type:'application/xml'});
  callback(blob);
};
