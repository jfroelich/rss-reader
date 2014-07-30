// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.feed = lucu.feed || {};

/**
 * Removes a feed and its dependencies
 * TODO: lucu.feed.removeById no longer sends message when complete, caller
 * needs to do this.
 * //chrome.runtime.sendMessage({type:'unsubscribe',feed:id,entriesDeleted:counter});
 */
lucu.feed.removeById = function(db, id, onComplete) {
  var tx = db.transaction(['entry','feed'],'readwrite');
  var feedStore = tx.objectStore('feed');
  var deleteRequest = feedStore.delete(id);
  deleteRequest.onsuccess = lucu.entry.removeByFeed.bind(
    deleteRequest, tx, id, onComplete.bind(null, id));

  // TODO: delete this once the new bind stuff tested
  //deleteRequest.onsuccess = function() {
  //  lucu.entry.removeByFeed(tx, id, function(numDeleted) {
  //    onComplete(id, numDeleted);
  //  });
  //};

};
