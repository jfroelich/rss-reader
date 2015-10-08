// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: this file only contains add feed function, rename file or 
// move this function to the area that uses it

// TODO: use lucu.subscription, and rename it to lucu.subscription.subscribe

// TODO: ensure no future pubdates?
// TODO: use the async's approach to error handling. Only use
// one callback. The first argument should be the error object.
lucu.addFeed = function(database, feed, onComplete, onerror) {
  'use strict';

  const storable = {};
  storable.url = feed.url;
  storable.schemeless = lucu.url.getSchemeless(storable.url);

  const clean = lucu.sanitizeFeed(feed);
  
  // NOTE: title must be defined or subscriptions list sorting fails
  storable.title = clean.title || '';
  
  if(clean.description) {
    storable.description = clean.description;
  }
  
  if(clean.link) {
    storable.link = clean.link;
  }

  if(clean.date) {
    storable.date = clean.date;
  }

  if(feed.fetched) {
    storable.fetched = feed.fetched;
  }
  
  storable.created = Date.now();

  const transaction = database.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(storable);
  
  // Triggers onerror when schemeless already exists
  request.onerror = onerror;

  const onsuccess = lucu.addFeedOnSuccess.bind(request, database, storable, 
    feed.entries, onComplete);
  request.onsuccess = onsuccess;
};

lucu.addFeedOnSuccess = function(database, feed, entries, onComplete, event) {
  'use strict';
  feed.id = event.target.result;
  const merge = lucu.entry.merge.bind(null, database, feed);
  async.forEach(entries, merge, onComplete);
};
