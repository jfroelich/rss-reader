// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: this file only contains add feed funciton, just rename file or 
// move this function to the area that uses it

// TODO: use lucu.subscription, and rename it to lucu.subscription.subscribe


// TODO: ensure no future pubdates?
// TODO: use the async's approach to error handling. Only use
// one callback. The first argument should be the error object.
lucu.addFeed = function(db, feed, onComplete, onerror) {
  'use strict';
  var storable = {};
  storable.url = feed.url;
  var schemeless = new URI(storable.url);
  schemeless.protocol('');
  storable.schemeless = schemeless.toString().substring(2);
  var clean = lucu.sanitizeFeed(feed);
  // NOTE: title must be defined or subscriptions list sorting fails
  storable.title = clean.title || '';
  if(clean.description) storable.description = clean.description;
  if(clean.link) storable.link = clean.link;
  if(clean.date) storable.date = clean.date;
  if(feed.fetched) storable.fetched = feed.fetched;
  storable.created = Date.now();
  var entries = feed.entries;
  var mergeEntry = lucu.entry.merge.bind(null, db, storable);
  var tx = db.transaction('feed','readwrite');
  var store = tx.objectStore('feed');
  var request = store.add(storable);
  request.onsuccess = function() {
    storable.id = this.result;
    async.forEach(entries, mergeEntry, onComplete);
  };
  // Triggers onerror when schemeless already exists
  request.onerror = onerror;
};
