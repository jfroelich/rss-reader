// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

// Finds a feed by url, ignoring scheme

lucu.feed.findByURL = function(url, callback, fallback) {
  'use strict';
  var onConnect = lucu.feed.findByURLOnConnect.bind(null, url, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.findByURLOnConnect = function(url, callback, error, database) {
  'use strict';
  var transaction = database.transaction('feed');
  var feeds = transaction.objectStore('feed');
  var urls = feeds.index('schemeless');
  var schemelessURL = lucu.url.getSchemeless(url);
  var request = urls.get(schemelessURL);
  request.onsuccess = lucu.feed.findByURLOnSuccess.bind(request, callback);
};

lucu.feed.findByURLOnSuccess = function(callback, event) {
  'use strict';
  var feed = event.target.result;
  callback(feed);
};

// Get a feed object by its id
lucu.feed.findById = function(id, callback, fallback) {
  'use strict';
  var onConnect = lucu.feed.findByIdOnConnect.bind(null, id, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.findByIdOnConnect = function(id, callback, error, database) {
  'use strict';

  var transaction = database.transaction('feed');
  var store = transaction.objectStore('feed');
  var request = store.get(id);
  request.onsuccess = lucu.feed.findByIdOnSuccess.bind(request, callback);
};

lucu.feed.findByIdOnSuccess = function(callback, event) {
  'use strict';
  var feed = event.target.result;
  callback(feed);
};

lucu.feed.forEach = function(callback, onComplete, sortByTitle, fallback) {
  'use strict';
  var onConnect = lucu.feed.forEachOnConnect.bind(null, callback, onComplete, 
    sortByTitle);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.forEachOnConnect = function(callback, onComplete, sortByTitle, error, 
  database) {
  'use strict';
  var transaction = database.transaction('feed');
  transaction.oncomplete = onComplete;
  var store = transaction.objectStore('feed');

  if(sortByTitle) {
    store = store.index('title');
  }

  var request = store.openCursor();
  request.onsuccess = lucu.feed.forEachOnSuccess.bind(request, callback);
};

lucu.feed.forEachOnSuccess = function(callback, event) {
  'use strict';
  var cursor = event.target.result;
  if(!cursor) return;
  var feed = cursor.value;
  callback(feed);
  cursor.continue();
};
