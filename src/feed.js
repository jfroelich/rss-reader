// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

// Finds a feed by url, ignoring scheme
lucu.feed.findByURL = function(url, callback, fallback) {
  'use strict';
  const onConnect = lucu.feed.findByURLOnConnect.bind(null, url, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.findByURLOnConnect = function(url, callback, error, database) {
  'use strict';
  const transaction = database.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const urls = feeds.index('schemeless');
  const schemelessURL = lucu.url.getSchemeless(url);
  const request = urls.get(schemelessURL);
  request.onsuccess = lucu.feed.findByURLOnSuccess.bind(request, callback);
};

lucu.feed.findByURLOnSuccess = function(callback, event) {
  'use strict';
  const feed = event.target.result;
  callback(feed);
};

// Get a feed object by its id
lucu.feed.findById = function(id, callback, fallback) {
  'use strict';
  const onConnect = lucu.feed.findByIdOnConnect.bind(null, id, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.findByIdOnConnect = function(id, callback, error, database) {
  'use strict';

  const transaction = database.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const request = feeds.get(id);
  request.onsuccess = lucu.feed.findByIdOnSuccess.bind(request, callback);
};

lucu.feed.findByIdOnSuccess = function(callback, event) {
  'use strict';
  const feed = event.target.result;
  callback(feed);
};

// Iterates over each feed in the database
lucu.feed.forEach = function(callback, onComplete, sortByTitle, fallback) {
  'use strict';
  const onConnect = lucu.feed.forEachOnConnect.bind(null, callback, 
    onComplete, sortByTitle);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.forEachOnConnect = function(callback, onComplete, sortByTitle, error, 
  database) {
  'use strict';
  const transaction = database.transaction('feed');
  transaction.oncomplete = onComplete;
  
  var feeds = transaction.objectStore('feed');
  if(sortByTitle) {
    feeds = feeds.index('title');
  }

  const request = feeds.openCursor();
  request.onsuccess = lucu.feed.forEachOnSuccess.bind(request, callback);
};

lucu.feed.forEachOnSuccess = function(callback, event) {
  'use strict';
  const cursor = event.target.result;
  if(!cursor) return;
  const feed = cursor.value;
  callback(feed);
  cursor.continue();
};
