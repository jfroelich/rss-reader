// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// Second level namespace for opml related features
lucu.opml = lucu.opml || {};

lucu.opml.exportBlob = function(onComplete) {
  'use strict';

  var waterfall = [
    lucu.opml.exportConnect,
    lucu.opml.exportGetFeeds,
    lucu.opml.exportSerialize
  ];

  // TODO: test, null is 'this' and onComplete is the implied first arg
  var completed = lucu.opml.exportCompleted.bind(null, onComplete);

  async.waterfall(waterfall, completed);
};

// TODO: this should be refactored a bit more
lucu.opml.exportConnect = function(callback) {
  'use strict';

  var onConnect = lucu.opml.exportOnConnect.bind(null, callback);
  lucu.database.connect(onConnect, callback);
};

lucu.opml.exportOnConnect = function(callback, error, database) {
  'use strict';
  callback(null, database);
};

lucu.opml.exportGetFeeds = function(database, callback) {
  'use strict';
  var transaction = database.transaction('feed');
  var store = transaction.objectStore('feed');
  var request = store.openCursor();
  var feeds = [];
  transaction.oncomplete = function() {
    callback(null, feeds);
  };
  var onsuccess = lucu.opml.exportGetFeedsOnSuccess.bind(request, feeds);
  request.onsuccess = onsuccess;
};

lucu.opml.exportGetFeedsOnSuccess = function(feeds, event) {
  var cursor = event.target.result;
  if(!cursor) return;
  feeds.push(cursor.value);
  cursor.continue();
};

lucu.opml.exportCompleted = function(onComplete, error, opmlString) {
  'use strict';
  var blob = new Blob([opmlString], {type:'application/xml'});
  onComplete(blob);
};

lucu.opml.exportSerialize = function(feeds, callback) {
  'use strict';
  var document = lucu.opml.createDocument(feeds, 'subscriptions.xml');
  var xs = new XMLSerializer();
  var opml = xs.serializeToString(document);
  callback(null, opml);
};
