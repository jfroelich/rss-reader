// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

// TODO: this file only contains add feed function, rename file or 
// move this function to the area that uses it

// TODO: merge addFeed with updateFeed

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
  
  // NOTE: this lib is no longer responsible for merging entries when adding 
  // a feed. In the subscription context, we do not want to merge entries because
  // that takes too long. Therefore, this function is temporarily a NOOP. 
  // TODO: delete the function?

  // Because it is a noop, it still has to call onComplete. It calls onComplete
  // without an arg in case it is used with async.waterfall.
  onComplete();

  // Old code below
  //feed.id = event.target.result;
  //const merge = lucu.entry.merge.bind(null, database, feed);
  //async.forEach(entries, merge, onComplete);
};
