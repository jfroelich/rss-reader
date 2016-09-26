// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var rdr = rdr || {};
rdr.feed = rdr.feed || {};

// Gets the last url from the feed's urls. This expects that the feed always
// has at least one url.
// @param feed {Object} the feed object to inspect
// @return {String} a url string
rdr.feed.getURL = function(feed) {
  if(!feed.urls.length) {
    throw new Error('feed missing url');
  }

  return feed.urls[feed.urls.length - 1];
};

// Append the url to the feed
// @param feed {Object} the feed to modify
// @param url {string} the url to append
// @return {boolean} true if url appended
rdr.feed.addURL = function(feed, url) {
  if(!('urls' in feed)) {
    feed.urls = [];
  }

  const urlObject = new URL(url);
  urlObject.hash = '';
  const normalizedURLString = urlObject.href;

  for(let feedURL of feed.urls) {
    if(feedURL === normalizedURLString) {
      return false;
    }
  }

  feed.urls.push(normalizedURLString);
  return true;
};

// Returns a new object that has been sanitized. This checks for invalid values
// and tries to minimize XSS vulnerables in html strings.
// This currently only does asserts in some cases.
rdr.feed.sanitize = function(inputFeed) {
  const feed = Object.assign({}, inputFeed);

  if(feed.id) {

    if(!Number.isInteger(feed.id) || feed.id < 1) {
      throw new Error('invalid feed id: ' + feed.id);
    }

  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type) {

    if(!(feed.type in types)) {
      throw new Error('invalid feed type: ' + feed.type);
    }

  }

  if(feed.title) {
    let title = feed.title;
    title = rdr.utils.filterControlChars(title);
    title = rdr.html.replaceTags(title, '');
    title = title.replace(/\s+/, ' ');
    const titleMaxStoreLength = 1024;
    title = rdr.html.truncate(title, titleMaxStoreLength, '');
    feed.title = title;
  }

  if(feed.description) {
    let description = feed.description;
    description = rdr.utils.filterControlChars(description);
    description = rdr.html.replaceTags(description, '');
    description = description.replace(/\s+/, ' ');
    const preTruncLen = description.length;
    const descMaxLength = 1024 * 10;
    description = rdr.html.truncate(description, descMaxLength, '');
    if(preTruncLen > description.length) {
      console.warn('Truncated description', description);
    }

    feed.description = description;
  }

  return feed;
};

// @param connection {IDBDatabase} an open database connection
// @param feed {Feed} the feed object to store
// @param callback {function} optional callback function
rdr.feed.update = function(db, feed, callback) {
  if(!feed.id) {
    throw new Error('Attempted to update a feed without a valid id');
  }

  if(!rdr.feed.getURL(feed)) {
    throw new Error('Attempted to update a feed without a url');
  }

  const ctx = {'feed': feed, 'callback': callback};
  ctx.feed = rdr.feed.sanitize(ctx.feed);
  ctx.feed.dateUpdated = new Date();
  ctx.feed = rdr.utils.filterEmptyProps(ctx.feed);
  const tx = db.transaction('feed', 'readwrite');
  const store = tx.objectStore('feed');
  const request = store.put(ctx.feed);
  if(callback) {
    request.onsuccess = rdr.feed._updatePutOnSuccess.bind(ctx);
    request.onerror = rdr.feed._updatePutOnError.bind(ctx);
  }
};

rdr.feed._updatePutOnSuccess = function(event) {
  this.callback({'type': 'success', 'feed': this.feed});
};

rdr.feed._updatePutOnError = function(event) {
  console.error(event.target.error);
  this.callback({'type': 'error', 'feed': this.feed});
};

rdr.feed.add = function(db, feed, callback) {
  if('id' in feed) {
    throw new Error('Attempted to add a feed with an id property');
  }

  if(!rdr.feed.getURL(feed)) {
    throw new Error('Attempted to add a feed without a url');
  }

  const ctx = {'feed': feed, 'callback': callback};
  ctx.feed = rdr.feed.sanitize(ctx.feed);
  ctx.feed.dateCreated = new Date();
  ctx.feed = rdr.utils.filterEmptyProps(ctx.feed);
  const transaction = db.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(ctx.feed);
  if(callback) {
    request.onsuccess = rdr.feed._addOnSuccess.bind(ctx);
    request.onerror = rdr.feed._addOnError.bind(ctx);
  }
}

rdr.feed._addOnSuccess = function(event) {
  this.feed.id = event.target.result;
  this.callback({'type': 'success', 'feed': this.feed});
};

rdr.feed._addOnError = function(event) {
  console.error(event.target.error);
  this.callback({'type': 'error'});
};

rdr.feed.getAll = function(db, callback) {
  const ctx = {
    'callback': callback,
    'didCallback': false,
    'feeds': []
  };
  const tx = db.transaction('feed');
  const store = tx.objectStore('feed');
  const request = store.openCursor();
  request.onsuccess = rdr.feed._getAllOnSuccess.bind(ctx);
  request.onerror = rdr.feed._getAllOnError.bind(ctx);
};

rdr.feed._getAllOnSuccess = function(event) {
  const cursor = event.target.result;
  if(!cursor) {
    rdr.feed._getAllOnComplete.call(this);
    return;
  }

  this.feeds.push(cursor.value);
  cursor.continue();
};

rdr.feed._getAllOnError = function(event) {
  console.error(event.target.error);
  rdr.feed._getAllOnComplete.call(this);
};

rdr.feed._getAllOnComplete = function() {
  if(this.didCallback) {
    throw new Error('duplicated callback');
  }

  this.didCallback = true;
  this.callback(this.feeds);
};

// Returns a new object of the old feed merged with the new feed. Fields from
// the new feed take precedence, except for URLs, which are merged to generate
// a distinct ordered set of oldest to newest url.
rdr.feed.merge = function(oldFeed, newFeed) {
  const mergedFeed = Object.assign({}, oldFeed, newFeed);
  mergedFeed.urls = [...oldFeed.urls];
  for(let url of newFeed.urls) {
    rdr.feed.addURL(mergedFeed, url);
  }
  return mergedFeed;
};
