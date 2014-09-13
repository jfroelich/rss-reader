// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

// Functions for read-like queries of feed storage

'use strict';

var lucu = lucu || {};
lucu.feed = lucu.feed || {};

lucu.feed.getAll = function(db, callback) {
  var feeds = [];
  var tx = db.transaction('feed');
  var cursorRequest = tx.objectStore('feed').openCursor();
  tx.oncomplete = callback.bind(undefined, feeds);
  cursorRequest.onsuccess = lucu.feed.getAllShift.bind(cursorRequest, feeds);
};

// Private helper for getAll
lucu.feed.getAllShift = function(feedsArray) {
  var cursor = this.result;
  if(!cursor) {
    return;
  }
  feedsArray.push(cursor.value);
  cursor.continue();
};

lucu.feed.countAll = function(db, callback) {
  var tx = db.transaction('feed');
  var feedStore = tx.objectStore('feed');
  var countRequest = feedStore.count();
  countRequest.onsuccess = lucu.feed.onCountAll.bind(countRequest, callback);
};

// Private helper
lucu.feed.onCountAll = function(onComplete) {
  onComplete(this.result);
};

// Finds the feed corresponding to the url, without regard
// to its scheme.
lucu.feed.findBySchemelessURL = function(db, url, callback) {

  // Uses medialize URI lib
  function filterScheme(url) {
    var uri = URI(url);
    uri.protocol('');
    var result = uri.toString().substring(2);
    // console.debug(result);
    return result;
  }

  //var schemelessURL = lucu.uri.filterScheme(url);

  var schemelessURL = filterScheme(url);
  var feedStore = db.transaction('feed').objectStore('feed');
  var schemelessIndex = feedStore.index('schemeless');
  var request = schemelessIndex.get(schemelessURL);
  request.onsuccess = lucu.feed.onFindSchemeless.bind(request, callback);
};

// Private helper
lucu.feed.onFindSchemeless = function(onComplete) {
  onComplete(this.result);
};

lucu.feed.forEach = function(db, handleFeed, onComplete, sortByTitle) {

  var tx = db.transaction('feed');
  var store;

  if(sortByTitle) {
    store = tx.objectStore('feed').index('title');
  } else {
    store = tx.objectStore('feed');
  }

  tx.oncomplete = onComplete;

  var cursorRequest = store.openCursor();
  cursorRequest.onsuccess = lucu.feed.forEachShift.bind(
    cursorRequest, handleFeed);
};

// Private helper
lucu.feed.forEachShift = function(callback) {
  var cursor = this.result;
  if(cursor) {
    callback(cursor.value);
    cursor.continue();
  }
};
