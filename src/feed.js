// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

// Finds a feed by url, ignoring scheme
lucu.feed.findByURL = function(url, callback, fallback) {
  'use strict';
  const onConnect = lucu.feed.findByURLOnConnect.bind(null, url, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.findByURLOnConnect = function(url, callback, error, database) {
  'use strict';
  const transaction = database.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const urls = feeds.index('schemeless');
  const schemelessURL = lucu.url.getSchemeless(url);
  const request = urls.get(schemelessURL);
  request.onsuccess = lucu.feed.findByURLOnSuccess.bind(request, callback);
};

lucu.feed.findByURLOnSuccess = function(callback, event) {
  'use strict';
  const feed = event.target.result;
  callback(feed);
};

// Get a feed object by its id
lucu.feed.findById = function(id, callback, fallback) {
  'use strict';
  const onConnect = lucu.feed.findByIdOnConnect.bind(null, id, callback);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.findByIdOnConnect = function(id, callback, error, database) {
  'use strict';

  const transaction = database.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const request = feeds.get(id);
  request.onsuccess = lucu.feed.findByIdOnSuccess.bind(request, callback);
};

lucu.feed.findByIdOnSuccess = function(callback, event) {
  'use strict';
  const feed = event.target.result;
  callback(feed);
};

// Iterates over each feed in the database
lucu.feed.forEach = function(callback, onComplete, sortByTitle, fallback) {
  'use strict';
  const onConnect = lucu.feed.forEachOnConnect.bind(null, callback, 
    onComplete, sortByTitle);
  lucu.database.connect(onConnect, fallback);
};

lucu.feed.forEachOnConnect = function(callback, onComplete, sortByTitle, error, 
  database) {
  'use strict';
  const transaction = database.transaction('feed');
  transaction.oncomplete = onComplete;
  
  var feeds = transaction.objectStore('feed');
  if(sortByTitle) {
    feeds = feeds.index('title');
  }

  const request = feeds.openCursor();
  request.onsuccess = lucu.feed.forEachOnSuccess.bind(request, callback);
};

lucu.feed.forEachOnSuccess = function(callback, event) {
  'use strict';
  const cursor = event.target.result;
  if(!cursor) return;
  const feed = cursor.value;
  callback(feed);
  cursor.continue();
};


lucu.feed.selectFeeds = function(database, callback) {
  'use strict';

  const feeds = [];
  const transaction = database.transaction('feed');
  const store = transaction.objectStore('feed');
  transaction.oncomplete = lucu.feed.onSelectFeedsComplete.bind(
    transaction, feeds, callback);
  const request = store.openCursor();
  request.onsuccess = lucu.feed.onSelectFeed.bind(null, feeds);
};

lucu.feed.onSelectFeed = function(feeds, event) {
  'use strict';

  const cursor = event.target.result;
  if(!cursor) return;
  feeds.push(cursor.value);
  cursor.continue();
};

lucu.feed.onSelectFeedsComplete = function(feeds, callback, event) {
  'use strict';
  callback(feeds);
};



/**
 * @param database an open database connection
 * @param original the original feed loaded from the database, optional
 * @param feed the feed to insert or the feed with properties to overwrite
 * the original
 * @param callback the function to call when finished (no args)
 */
lucu.feed.put = function(database, original, feed, callback) {
  'use strict';

  // TODO: check last modified date of the remote xml file to avoid 
  // pointless updates?

  // Sanitize new properties
  if(feed.title) {
    feed.title = lucu.feed.sanitizeString(feed.title);
  }

  if(feed.description) {
    feed.description = lucu.feed.sanitizeString(feed.description);
  }

  if(feed.link) {
    feed.link  = lucu.feed.sanitizeString(feed.link);
  }

  // Create a storable representation of the feed
  const storable = {};

  // Copy over the earlier id
  // NOTE: for some reason, poll was not doing this?
  if(original) {
    storable.id = original.id;
  }

  storable.url = feed.url;

  if(original) {
    storable.schemeless = original.schemeless;
  } else {
    storable.schemeless = lucu.url.getSchemeless(storable.url);
  }

  // Title is required for now (due to issue with displaying feeds
  // on the options page feed list)
  storable.title = feed.title || '';

  if(feed.description) {
    storable.description = storable.description;
  }

  if(feed.link) {
    storable.link = feed.link;
  }

  // TODO: ensure the date is not beyond the current date?
  if(feed.date) {
    storable.date = feed.date;
  }

  storable.fetched = feed.fetched;

  if(original) {
    // TODO: this should not be changing the date updated unless something
    // actually changed ?
    storable.updated = Date.now();
    storable.created = original.created;
  } else {
    storable.created = Date.now();
  }

  const transaction = database.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);

  request.onsuccess = function(event) {
    callback();
  };

  request.onerror = function(event) {
    console.debug('Error updating feed %s', feed.url);
    console.dir(event);
    callback();
  };
};

lucu.feed.sanitizeString = function(string) {
  'use strict';

  // TODO: html entities?

  if(!string) {
    return;
  }

  string = lucu.string.stripTags(string);

  if(string) {
    string = lucu.string.stripControls(string);
  }

  string = lucu.string.condenseWhitespace(string);
  
  if(string) {
    string = string.trim();
  }
  
  return string;
};
