// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

function getAllFeeds(db, callback) {
  var tx = db.transaction('feed');
  var cursorRequest = tx.objectStore('feed').openCursor();
  var feeds = [];
  tx.oncomplete = callback.bind(undefined, feeds);
  cursorRequest.onsuccess = getAllFeedsConsumeCursor.bind(cursorRequest, feeds);
}

function getAllFeedsConsumeCursor(feedsArray) {
  var cursor = this.result;
  if(cursor) {
    feedsArray.push(cursor.value);
    cursor.continue();
  }
}

function countAllFeeds(db, callback) {
  var feedStore = db.transaction('feed').objectStore('feed');

  // TODO: move this function out of here
  feedStore.count().onsuccess = function() {
    callback(this.result);
  };
}

/**
 * Finds the feed corresponding to the url, without regard
 * to its scheme.
 */
function findFeedBySchemelessURL(db, url, callback) {
  var schemelessURL = lucu.uri.filterScheme(url);
  var feedStore = db.transaction('feed').objectStore('feed');
  var schemelessIndex = feedStore.index('schemeless');

  // TODO: move this function out of here
  schemelessIndex.get(schemelessURL).onsuccess = function() {
    callback(this.result);
  };
}

function forEachFeed(db, callback, oncomplete, sortByTitle) {
  var tx = db.transaction('feed');
  var store;

  if(sortByTitle) {
    store = tx.objectStore('feed').index('title');
  } else {
    store = tx.objectStore('feed');
  }

  tx.oncomplete = oncomplete;

  var cursorRequest = store.openCursor();
  cursorRequest.onsuccess = forEachFeedOnSuccess.bind(cursorRequest,callback);
}

function forEachFeedOnSuccess(callback) {
  var cursor = this.result;
  if(cursor) {
    callback(cursor.value);
    cursor.continue();
  }
}
