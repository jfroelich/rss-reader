// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

// Find a feed by url, ignoring protocol
lucu.feed.findByURL = function(url, callback, fallback) {
  'use strict';
  lucu.database.connect(onConnect, fallback);

  function onConnect(error, database) {
    const transaction = database.transaction('feed');
    const urls = transaction.objectStore('feed').index('schemeless');
    const request = urls.get(lucu.url.getSchemeless(url));
    request.onsuccess = onGetURL;
  }

  function onGetURL(event) {
    callback(event.target.result);
  }
};

// Find a feed by id
lucu.feed.findById = function(id, callback, fallback) {
  'use strict';
  lucu.database.connect(function(error, database) {
    const feeds = database.transaction('feed').objectStore('feed');
    const request = feeds.get(id);
    request.onsuccess = function(event) {
      callback(event.target.result);
    };
  }, fallback);
};

// Iterates over each feed in the database
lucu.feed.forEach = function(callback, onComplete, sortByTitle, fallback) {
  'use strict';
  lucu.database.connect(function(error, database) {
    const transaction = database.transaction('feed');
    transaction.oncomplete = onComplete;
  
    let feeds = transaction.objectStore('feed');
    if(sortByTitle) {
      feeds = feeds.index('title');
    }

    const request = feeds.openCursor();
    request.onsuccess = function(event) {
      const cursor = event.target.result;
      if(!cursor) return;
      callback(cursor.value);
      cursor.continue();
    };
  }, fallback);
};

lucu.feed.selectFeeds = function(database, callback) {
  'use strict';
  const feeds = [];
  const transaction = database.transaction('feed');
  const store = transaction.objectStore('feed');
  transaction.oncomplete = function(event) {
    callback(feeds);
  };
  const request = store.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(!cursor) return;
    feeds.push(cursor.value);
    cursor.continue();
  };
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
