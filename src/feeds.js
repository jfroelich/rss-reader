// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

var lucu = lucu || {};

/**
 * Fetches the XML for a feed, parses it into a javascript object, and passes
 * this along to a callback. If an error occurs along the way, calls the onerror
 * callback instead.
 *
 * TODO: standardize the error object passed to onerror
 * TODO: somehow store responseURL? intelligently react to redirects
 * TODO: remove duplicate entries?
 * TODO: make online check caller's responsibility?
 * TODO: change to use single callback, async.forEach style
 * TODO: should filtering and rewriting take place somewhere else?
 */
lucu.fetchFeed = function(url, onComplete, onError, timeout) {
  'use strict';

  onError = onError || function (event) {
    console.dir(event);
  };

  if(navigator && !navigator.onLine) {
    return onError({type: 'offline', url: url});
  }

  var request = new XMLHttpRequest();
  request.timeout = timeout;
  request.onerror = function(event) {
    console.debug('fetch feed error');
    console.dir(event);
    onError(event);
  };
  request.ontimeout = onError;
  request.onabort = onError;
  request.onload = function () {
    var document = this.responseXML;
    if(!document || !document.documentElement) {
      return onError({type: 'invalid-xml', target: this});
    }

    try {
      var feed = lucu.deserializeFeed(document);
    } catch(e) {
      return onError({type: 'invalid-xml', target: this, details: e});
    }

    feed.entries = feed.entries.filter(function (entry) {
      return entry.link;
    }).map(function (entry) {
      entry.link = lucu.rewriteURL(entry.link);
      return entry;
    });

    onComplete(feed);
  };

  request.open('GET', url, true);
  request.overrideMimeType('application/xml');
  request.send();
};

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
  if(clean.link) storable.link =  clean.link;
  if(clean.date) storable.date = clean.date;
  if(feed.fetched) storable.fetched = feed.fetched;
  storable.created = Date.now();
  var entries = feed.entries;
  var addEntry = lucu.mergeEntry.bind(null, db, storable);
  var tx = db.transaction('feed','readwrite');
  var store = tx.objectStore('feed');
  var request = store.add(storable);
  request.onsuccess = function() {
    storable.id = this.result;
    async.forEach(entries, addEntry, onComplete);
  };
  // Triggers onerror when schemeless already exists
  request.onerror = onerror;
};


/**
 * Returns a sanitized copy of dirtyFeed.
 *
 * TODO: html entities?
 */
lucu.sanitizeFeed = function(feed) {
  'use strict';
  function sanitizeString(str) {
    if(!str) return;
    str = lucu.stripTags(str);
    if(str) str = lucu.stripControls(str);
    if(str) str = str.replace(/\s+/,' ');
    if(str) str = str.trim();
    return str;
  }

  var output = {};
  var title = sanitizeString(feed.title);
  if(title) output.title = title;
  var description = sanitizeString(feed.description);
  if(description) output.description = description;
  var link = sanitizeString(feed.link);
  if(link) output.link = link;
  if(feed.date) output.date = feed.date;
  return output;
};


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

  // TODO: just use entry.link as key
  var seed = entry.link || entry.title || entry.content || '';
  storable.hash = seed.split('').reduce(function (sum, string) {
    return (sum * 31 + string.charCodeAt(0)) % 4294967296;
  }, 0);

  if(!storable.hash) {
    return callback();
  }

  storable.unread = 1;
  if(entry.author) storable.author = entry.author;
  if(entry.link) storable.link = entry.link;
  if(entry.title) storable.title = entry.title;
  if(entry.pubdate) {
    var date = new Date(entry.pubdate);
    if(date && date.toString() == '[object Date]' && isFinite(date)) {
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

lucu.selectAllFeeds = function(db, callback) {
  var feeds = [];
  var store = db.transaction('feed').objectStore('feed');
  store.openCursor().onsuccess = function(event) {
    var cursor = event.target.result;
    if(cursor) {
      feeds.push(cursor.value);
      cursor.continue();
    } else {
      callback(null, db, feeds);
    }
  };
};


/**
 * Iterates over a feed's entries and replaces the html content property
 * of each entry with its full html according to its link. Forwards the
 * input feed to the callback.
 *
 * Entries that already exist within the local database are ignored.
 * If a database error occurs then no augmentation takes place and this
 * simply forwards the feed to the callback.
 *
 * TODO: change callback args so that conn.error can be set to callback?
 * TODO: use async.waterfall
 * TODO: use a common openDatabase function?
 */
lucu.augmentEntries = function(feed, callback) {
  'use strict';

  var conn = indexedDB.open(lucu.DB_NAME, lucu.DB_VERSION);
  conn.onerror = function () {
    console.warn(error);
    callback(feed);
  };
  conn.onblocked = function () {
    console.warn(error);
    callback(feed);
  };
  conn.onsuccess = function () {
    var db = this.result;
    var tx = db.transaction('entry');
    async.reject(feed.entries, lucu.findEntryByLink.bind(this, tx),
      updateEntries);
  };

  function updateEntries(entries) {
    async.forEach(entries, lucu.updateEntryContent, function () {
      callback(feed);
    });
  }
};

/**
 * Searches for an entry by its link url property. Passes either the
 * matching entry object or undefined to the callback.
 * TODO: relocate this function?
 */
lucu.findEntryByLink = function(transaction, entry, callback) {
  'use strict';
  var store = transaction.objectStore('entry');
  var index = store.index('link');
  var url = entry.link;
  index.get(url).onsuccess = function() {
    callback(this.result);
  };
};

/**
 * Fetch the html at entry.link and use it to replace entry.content
 *
 * TODO: I'd prefer this function pass back any errors to the callback. This
 * would require the caller that wants to not break from async.forEach early
 * wrap the call.
 * TODO: consider embedding iframe content?
 * TODO: consider sandboxing iframes?
 * TODO: should entry timeout be a parameter? I want it somehow to be
 * declared external to this function
 * TODO: html compression? like enforce boolean attributes? see kangax lib
 * TODO: scrubbing/html-tidy (e.g. remove images without src attribute?)
 * TODO: if pdf content type then maybe we embed iframe with src
 * to PDF? also, we should not even be trying to fetch pdfs? is this
 * just a feature of fetchHTML or does it belong here?
 * TODO: do something with responseURL?
 * TODO: I'd prefer this properly pass back errors to the callback and instead
 * require the caller to wrap this call in order to ignore such errors and
 * continue iteration if they want to use this function within the context of
 * async.forEach
 */
lucu.updateEntryContent = function(entry, callback) {
  'use strict';

  var entryTimeout = 20 * 1000;

  function onFetchError(error) {
    console.warn(error);
    callback();
  }

  var request = new XMLHttpRequest();
  request.timeout = entryTimeout;
  request.ontimeout = onFetchError;
  request.onerror = onFetchError;
  request.onabort = onFetchError;
  request.onload = function () {
    var document = this.responseXML;
    if(!document || !document.body) {
      console.debug('Cannot augment %s', this.responseURL);
      return callback();
    }

    lucu.resolveElements(document, this.responseURL);

    var images = document.body.getElementsByTagName('img');
    async.forEach(images, lucu.fetchImageDimensions, function () {
      entry.content = document.body.innerHTML ||
        'Unable to download content for this article';
      callback();
    });
  };
  request.open('GET', entry.link, true);
  request.responseType = 'document';
  request.send();
};

/**
 * Ensures that the width and height attributes of an image are set. If the
 * dimensions are set, the callback is called immediately. If not set, the
 * image is fetched and then the dimensions are set.
 *
 * TODO: is this file the proper location for this function?
 */
lucu.fetchImageDimensions = function(image, callback) {
  'use strict';

  var src = (image.getAttribute('src') || '').trim();
  var width = (image.getAttribute('width') || '').trim();
  if(!src || width || image.width ||
    width === '0' || /^0\s*px/i.test(width) ||
    /^data\s*:/i.test(src)) {
    return callback();
  }

  // We load the image within a separate document context because
  // the element may currently be contained within an inert document
  // context (such as the document created by an XMLHttpRequest or when
  // using document.implementation.createDocument)
  // TODO: think of a better way to specify the proxy. I should not be
  // relying on window explicitly here.
  var document = window.document;
  var proxy = document.createElement('img');

  proxy.onerror = function(event) {
    console.debug('Failed to fetch %s %o', src, proxy);
    callback();
  };

  proxy.onload = function(event) {
    image.width = proxy.width;
    image.height = proxy.height;
    callback();
  };
  proxy.src = src;
};
