// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};


// TODO: some entry link URLs from feeds are pre-chain-of-redirect-resolition, 
// and are technically duplicates because each redirects to the same URL at the 
// end of the redirect chain. Therefore we should be storing the terminal link,
// not the source link. Or maybe we should be storing both. That way a lookup
// will detect the article already exists and we store fewer dups
// I think that fetching does use responseURL, but we end up not using response
// URL at some point later in processing. Basically, the responseURL has to be
// detected at the point of augment, and we want to rewrite at that point
// So this note is here but technically this note belongs to several issues in
// the holistic view of the update process. Maybe it does not belong to subscribe
// and only to poll because maybe only poll should be downloading and augmenting
// entries, and subscribe should just add the feed and not add any entries because
// subscribe should be near instant. So subscribe should store the feed and then
// enqueue a one-feed poll update.

lucu.mergeEntry = function(db, feed, entry, callback) {
  'use strict';

  var storable = {};
  if(feed.link) {
  	storable.feedLink = feed.link;
  }

  if(feed.title) {
  	storable.feedTitle = feed.title;
  }

  storable.feed = feed.id;

  // NOTE: temporary note, this has not been tested, part of transition
  // to no-hash entries using link as primary
  // TODO: is this check even necessary? Maybe this never happens?
  if(!entry.link) {
    console.warn('Not storing entry without link: %o', entry);
    callback();
    return;
  }

  storable.link = entry.link;

  storable.unread = 1;
  if(entry.author) storable.author = entry.author;

  if(entry.title) storable.title = entry.title;
  if(entry.pubdate) {
    var date = new Date(entry.pubdate);
    if(lucu.date.isValid(date)) {
      storable.pubdate = date.getTime();
    }
  }

  if(!storable.pubdate && feed.date) {
  	storable.pubdate = feed.date;
  }

  storable.created = Date.now();
  if(entry.content) {
  	storable.content = entry.content;
  }

  // Now insert the entry if an entry with the same link does
  // not already exist. Technically this should implicitly fail
  // because of the unique flag on the link index of the entry 
  // object store. However, something isn't working correctly,
  // so instead this explicitly checks for the link

  // NOTE: we have to wrap callback to avoid passing parameters
  // to it (like event) due to how async lib works

  var transaction = db.transaction('entry', 'readwrite');
  var entryStore = transaction.objectStore('entry');

  var linkIndex = entryStore.index('link');

  var getByLinkRequest = linkIndex.get(storable.link);
  getByLinkRequest.onerror = function() {
    // console.debug('getByLinkRequest error for %s', storable.link);
    callback();
  };

  getByLinkRequest.onsuccess = function(event) {
    var oldEntry = event.target.result;
    if(oldEntry) {
      // console.debug('entry.link %s already exists, not adding', storable.link);
      callback();
      return;
    }

    var addEntryRequest = entryStore.add(storable);
    addEntryRequest.onsuccess = function() {
      // console.debug('Added entry %s', storable.link);
      callback();
    };

    addEntryRequest.onerror = function() {
      // console.debug('Add entry failure for %s', storable.link);
      callback();
    };
  };
};
