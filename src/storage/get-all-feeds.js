// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

/*
// Chrome apparently does not support getAll???? Or I am having some problems
// using it. Shimming it for now
// event.target.result will contain an array of raw feed objects
function getAllFeeds(connection, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.getAll();
  request.onsuccess = callback;
}
*/

function getAllFeeds(connection, callback) {
  const transaction = connection.transaction('feed');
  const store = transaction.objectStore('feed');
  const request = store.openCursor();
  const feeds = [];
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      callback(feeds);
    }
  };
}
