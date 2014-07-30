// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Removes a feed and its dependencies
 * TODO: removeFeedById no longer sends message when complete, caller
 * needs to do this.
 * //chrome.runtime.sendMessage({type:'unsubscribe',feed:id,entriesDeleted:counter});
 */
function removeFeedById(db, id, oncomplete) {
  var tx = db.transaction(['entry','feed'],'readwrite');

  // TODO: move this function out of here
  tx.objectStore('feed').delete(id).onsuccess = function() {
    lucu.entry.removeByFeed(tx, id, function(numDeleted) {
      oncomplete(id, numDeleted);
    });
  };
}
