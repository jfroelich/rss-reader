// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';
/**
 * Feed-related functions
 *
 * TODO: in the future, we should be storing two titles, a
 * human readonable one, and one for sorting when loading. Both
 * addFeed and updateFeed would be refactored.
 * TODO: because i do not validate a feed is live before adding,
 * need to periodically identify invalid feeds later.
 * TODO: addFeed no longer sends message when complete so the caller
 * needs to do this.
 * //chrome.runtime.sendMessage({type:'subscribe',feed:feed});
 * TODO: removeFeedById no longer sends message when complete, caller
 * needs to do this.
 * //chrome.runtime.sendMessage({type:'unsubscribe',feed:id,entriesDeleted:counter});
 * TODO: the caller of updateFeed needs to set feed.fetched
 * TODO: the caller of updateFeed should pass in last modified
 * date of the remote xml file so we can avoid pointless updates
 * TODO: updateFeed should not be changing the date updated unless
 * something actually changed.
 */
function addFeed(db, feed, oncomplete, onerror) {
  console.log('addFeed url %s', feed.url);


  var cleanedFeed = sanitizeRemoteFeed(feed);

  var storableFeed = {};
  storableFeed.url = feed.url;
  storableFeed.schemeless = getSchemelessURL(storableFeed.url);

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
    mergeEntries(db, storableFeed, feed.entries, oncomplete);
  };
}

/**
 * Updates the localFeed according to the properties in remoteFeed,
 * merges in any new entries present in the remoteFeed, and then
 * calls oncomplete. This expects local feed to be the feed object
 * loaded from the feedStore in the database.
 */
function updateFeed(db, localFeed, remoteFeed, oncomplete) {

  var cleanedFeed = sanitizeRemoteFeed(remoteFeed);

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
  putFeedRequest.onerror = console.error;
  putFeedRequest.onsuccess = function() {
    mergeEntries(db, localFeed, remoteFeed.entries, oncomplete);
  }
}

/**
 * Returns a sanitized version of a remote feed object.
 * The remoteFeed object is not modified. Only certain
 * properties are sanitized and included in the returned object
 * TODO: deal with html entities
 */
function sanitizeRemoteFeed(remoteFeed) {
  var output = {};

  var title = sanitizeRemoteFeedProperty(remoteFeed.title);
  if(title) {
    output.title = title;
  }

  var description = sanitizeRemoteFeedProperty(remoteFeed.description);
  if(description) {
    output.description = description;
  }

  var link = sanitizeRemoteFeedProperty(remoteFeed.link);
  if(link) {
    output.link = link;
  }

  if(remoteFeed.date) {
    output.date = remoteFeed.date;
  }

  return output;
}

/**
 * TODO: should we replace HTML entities after
 * stripping tags? Some entities? All entities?
 */
function sanitizeRemoteFeedProperty(str) {

  if(!str) {
    return;
  }

  str = stripTags(str);

  if(str) {
    str = stripControls(str);
  }

  // TODO: this should be a call to a separate function
  // or maybe merged with stripControls
  // (one pass instead of two)
  if(str) {
    str = str.replace(/\s+/,' ');
  }

  // If there is anything left in the string, trim it.
  if(str) {
    str = str.trim();
  }

  return str;
}

function getAllFeeds(db, callback) {
  var feeds = [];

  var tx = db.transaction('feed');
  var cursorRequest = tx.objectStore('feed').openCursor();

  tx.oncomplete = function() {
    callback(feeds);
  };

  cursorRequest.onsuccess = function() {
    var cursor = this.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    }
  };
}

function countAllFeeds(db, callback) {
  var feedStore = db.transaction('feed').objectStore('feed');
  feedStore.count().onsuccess = function(event) {
    callback(this.result);
  };
}

/**
 * Removes a feed and its dependencies
 */
function removeFeedById(db, id, oncomplete) {
  var tx = db.transaction(['entry','feed'],'readwrite');
  tx.objectStore('feed').delete(id).onsuccess = function() {
    removeEntriesByFeedId(tx, id, function(numDeleted) {
      oncomplete(id, numDeleted);
    });
  };
}

/**
 * Finds the feed corresponding to the url, without regard
 * to its scheme.
 */
function findFeedBySchemelessURL(db, url, callback) {
  var schemelessURL = getSchemelessURL(url);
  var feedStore = db.transaction('feed').objectStore('feed');
  var schemelessIndex = feedStore.index('schemeless');
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

  store.openCursor().onsuccess = function() {
    var cursor = this.result;
    if(cursor) {
      callback(cursor.value);
      cursor.continue();
    }
  };
}