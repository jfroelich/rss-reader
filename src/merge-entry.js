// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: intended to be used with async.forEach which halts
// if any call passes an error argument to the callback. Therefore
// this has to not pass anything. But I would prefer this passed
// back an error in event of an error.
lucu.mergeEntry = function(db, feed, entry, callback) {
  'use strict';

  var storable = {};
  if(feed.link) storable.feedLink = feed.link;
  if(feed.title) storable.feedTitle = feed.title;
  storable.feed = feed.id;

  // TODO: just use entry.link as key, maybe there is no need
  // to create a hash property?
  storable.hash = lucu.hashEntry(entry);

  if(!storable.hash) {
    return callback();
  }

  storable.unread = 1;
  if(entry.author) storable.author = entry.author;
  if(entry.link) storable.link = entry.link;
  if(entry.title) storable.title = entry.title;
  if(entry.pubdate) {
    var date = new Date(entry.pubdate);
    if(lucu.isValidDate(date)) {
      storable.pubdate = date.getTime();
    }
  }
  if(!storable.pubdate && feed.date) storable.pubdate = feed.date;
  storable.created = Date.now();
  if(entry.content) storable.content = entry.content;

  var tx = db.transaction('entry', 'readwrite');
  var store = tx.objectStore('entry');
  var request = store.add(storable);
  request.onsuccess = function() {
    callback();
  };
  request.onerror = function() {
    callback();
  };
};

lucu.isValidDate = function(date) {
  return date && date.toString() === '[object Date]' && isFinite(date);
};

lucu.hashEntry = function(entry) {
  // TODO: if we require link, then maybe there is no need to 
  // try and use title or content
  var seed = entry.link || entry.title || entry.content;
  return lucu.hashing.generate(seed);
};
