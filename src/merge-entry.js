// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

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

  var tx = db.transaction('entry', 'readwrite');
  var store = tx.objectStore('entry');

  // TEMPORARY
  console.debug('Storing entry %s', storable.link);
  // TEMPORARY

  // TODO: use put instead of add?
  var request = store.add(storable);

  // NOTE: async.forEach halts if any call passes an error argument 
  // to the callback. Therefore
  // this has to not pass anything. But I would prefer this passed
  // back an error in event of an error.
  request.onsuccess = function() {
    callback();
  };
  request.onerror = function() {
    callback();
  };
};
