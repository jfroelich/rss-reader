// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

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
  var mergeEntry = lucu.mergeEntry.bind(null, db, storable);
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

// TODO: the caller should pass in last modified date of the remote xml file
// so we can avoid pointless updates?
// TODO: this should not be changing the date updated unless something
// actually changed. However, we do want to indicate that the feed was
// checked
lucu.updateFeed = function(db, localFeed, remoteFeed, oncomplete) {
  var clean = lucu.sanitizeFeed(remoteFeed);
  if(clean.title) localFeed.title = clean.title;
  if(clean.description) localFeed.description = clean.description;
  if(clean.link) localFeed.link = clean.link;
  if(clean.date) localFeed.date = clean.date;
  localFeed.fetched = remoteFeed.fetched;
  localFeed.updated = Date.now();
  var tx = db.transaction('feed','readwrite');
  var store = tx.objectStore('feed');
  var request = store.put(localFeed);
  request.onerror = console.debug;
  var mergeEntry = lucu.mergeEntry.bind(null, db, localFeed);
  request.onsuccess = function() {
    async.forEach(remoteFeed.entries, mergeEntry, oncomplete);
  };
};
