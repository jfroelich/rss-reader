// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * Updates the localFeed according to the properties in remoteFeed,
 * merges in any new entries present in the remoteFeed, and then
 * calls oncomplete. This expects local feed to be the feed object
 * loaded from the feedStore in the database.
 * TODO: the caller of updateFeed needs to set feed.fetched
 * TODO: the caller of updateFeed should pass in last modified
 * date of the remote xml file so we can avoid pointless updates
 * TODO: updateFeed should not be changing the date updated unless
 * something actually changed.
 */
function updateFeed(db, localFeed, remoteFeed, oncomplete) {

  var cleanedFeed = lucu.feed.sanitize(remoteFeed);

  if(cleanedFeed.title) {
    localFeed.title = cleanedFeed.title;
  }

  if(cleanedFeed.description) {
    localFeed.description = cleanedFeed.description;
  }

  if(cleanedFeed.link) {
    localFeed.link = cleanedFeed.link;
  }

  if(cleanedFeed.date) {
    localFeed.date = cleanedFeed.date;
  }

  localFeed.fetched = remoteFeed.fetched;

  localFeed.updated = Date.now();

  var putFeedTransaction = db.transaction('feed','readwrite');
  var feedStore = putFeedTransaction.objectStore('feed');
  var putFeedRequest = feedStore.put(localFeed);
  putFeedRequest.onerror = console.debug;
  putFeedRequest.onsuccess = function() {
    lucu.entry.mergeAll(db, localFeed, remoteFeed.entries, oncomplete);
  }
}
