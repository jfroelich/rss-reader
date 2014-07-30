// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

/**
 * TODO: addFeed no longer sends message when complete so the caller
 * needs to do this.
 * chrome.runtime.sendMessage({type:'subscribe',feed:feed});
 */
function addFeed(db, feed, oncomplete, onerror) {
  console.debug('addFeed url %s', feed.url);

  var cleanedFeed = sanitizeRemoteFeed(feed);

  var storableFeed = {};
  storableFeed.url = feed.url;
  storableFeed.schemeless = lucu.uri.filterScheme(storableFeed.url);

  // title must be somehow defined or else it wont be returned when
  // sorting by title in forAllFeeds

  if(cleanedFeed.title) {
    storableFeed.title = cleanedFeed.title;
  } else {
    storableFeed.title = '';
  }

  if(cleanedFeed.description) {
    storableFeed.description = cleanedFeed.description;
  }

  if(cleanedFeed.link) {
    storableFeed.link =  cleanedFeed.link;
  }

  if(cleanedFeed.date) {
    storableFeed.date = cleanedFeed.date;
  }

  // This might not be set when importing OPML file
  // or when subscribing offline
  if(feed.fetched) {
    storableFeed.fetched = feed.fetched;
  }

  storableFeed.created = Date.now();

  // This is expected to trigger onerror when adding a feed
  // where schemeless is not unique because of the unique flag
  // on feedStore.schemelessIndex. This does not mean a coding
  // error occurred.

  var addFeedTransaction = db.transaction('feed','readwrite');
  var feedStore = addFeedTransaction.objectStore('feed');
  var addFeedRequest = feedStore.add(storableFeed);
  addFeedRequest.onerror = onerror;
  addFeedRequest.onsuccess = function() {
    storableFeed.id = this.result;
    lucu.entry.mergeAll(db, storableFeed, feed.entries, oncomplete);
  };
}
