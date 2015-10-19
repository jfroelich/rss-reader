// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

lucu.feed = lucu.feed || {};

// TODO: somehow store responseURL? 
// TODO: intelligently react to redirects
function fetchFeed(url, timeout, callback) {
  'use strict';
  const request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = callback;
  request.ontimeout = callback;
  request.onabort = callback;
  request.onload = function(event) {
    const document = event.target.responseXML;
    if(!document || !document.documentElement) {
      callback(event);
      return;
    }

    try {
      const feed = lucu.feed.deserialize(document);
      feed.url = url;
      feed.fetched = Date.now();
      feed.entries = feed.entries.filter(lucu.entry.hasLink);
      feed.entries.forEach(lucu.entry.rewriteLink);

      const seen = new Set();
      feed.entries = feed.entries.filter(function(entry) {
        if(seen.has(entry.link)) {
          return false;
        }

        seen.add(entry.link);
        return true;
      });

      callback(null, feed);
    } catch(e) {
      callback(e);
    }    
  };
  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();
}

// Find a feed by url, ignoring protocol
function findFeedByURL(connection, url, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const urls = transaction.objectStore('feed').index('schemeless');
  const request = urls.get(lucu.url.getSchemeless(url));
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
}

// Find a feed by id
function findFeedById(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('feed');
  const feeds = transaction.objectStore('feed');
  const request = feeds.get(id);
  request.onsuccess = function(event) {
    callback(event.target.result);
  };
}

// Iterates over stored feeds
function forEachFeed(connection, handleFeed, sortByTitle, callback) {
  'use strict';

  const transaction = connection.transaction('feed');
  transaction.oncomplete = callback;

  let feeds = transaction.objectStore('feed');
  if(sortByTitle) {
    feeds = feeds.index('title');
  }

  const request = feeds.openCursor();
  request.onsuccess = function(event) {
    const cursor = event.target.result;
    if(!cursor) return;
    handleFeed(cursor.value);
    cursor.continue();
  };
}

lucu.feed.put = function(connection, original, feed, callback) {
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

  if(feed.fetched) {
    storable.fetched = feed.fetched;
  }

  if(original) {
    // TODO: this should not be changing the date updated unless something
    // actually changed ?
    storable.updated = Date.now();
    storable.created = original.created;
  } else {
    storable.created = Date.now();
  }

  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.put(storable);

  request.onsuccess = function(event) {
    callback();
  };

  request.onerror = function(event) {
    console.debug('Error putting feed %s', JSON.stringify(feed));
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

lucu.feed.remove = function(connection, id, callback) {
  'use strict';
  const transaction = connection.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.delete(id);
  request.onsuccess = callback;
};

lucu.feed.unsubscribe = function(connection, id, callback) {
  'use strict';
  lucu.feed.remove(connection, id, function(event) {
    lucu.entry.removeByFeed(connection, id, callback);
  });
};
