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
  console.assert(feed);
  console.assert(feed.urls);
  console.assert(feed.urls.length);
  return feed.urls[feed.urls.length - 1];
};

// Append the url to the feed
// @param feed {Object} the feed to modify
// @param url {string} the url to append
// @return {boolean} true if url appended
rdr.feed.addURL = function(feed, url) {
  console.assert(feed);
  console.assert(url);

  if(!('urls' in feed)) {
    feed.urls = [];
  }

  // This can throw but shouldn't.
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
    console.assert(!isNaN(feed.id));
    console.assert(isFinite(feed.id));
    console.assert(feed.id > 0);
  }

  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type) {
    console.assert(feed.type in types, 'invalid type', feed.type);
  }

  if(feed.title) {
    let title = feed.title;
    title = rdr.filterControlChars(title);
    title = rdr.html.replaceTags(title, '');
    title = title.replace(/\s+/, ' ');
    const titleMaxStoreLength = 1024;
    title = rdr.html.truncate(title, titleMaxStoreLength, '');
    feed.title = title;
  }

  if(feed.description) {
    let description = feed.description;
    description = rdr.filterControlChars(description);
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
  console.assert(feed.id);
  const feedURL = rdr.feed.getURL(feed);
  console.assert(feedURL);
  console.debug('Updating feed', feedURL);

  const sanitizedFeed = rdr.feed.sanitize(feed);
  sanitizedFeed.dateUpdated = new Date();
  const storableFeed = rdr.filterUndefProps(sanitizedFeed);

  // Creating a new transaction can throw an exception if the database is in the
  // process of closing. That happens because of errors elsewhere in the code.
  // But those errors should not prevent rdr.feed.update from calling back with
  // an error. So catch the exception.
  let tx = null;
  try {
    tx = db.transaction('feed', 'readwrite');
  } catch(error) {
    console.error(storableFeed.urls, error);
    callback({'type': 'error', 'feed': feed, 'error': error});
    return;
  }

  const store = tx.objectStore('feed');
  const request = store.put(storableFeed);
  if(callback) {
    request.onsuccess = rdr.feed._updatePutOnSuccess.bind(request, callback,
      storableFeed);
    request.onerror = rdr.feed._updatePutOnError.bind(request, callback,
      storableFeed);
  }
};

rdr.feed._updatePutOnSuccess = function(callback, feed, event) {
  callback({'type': 'success', 'feed': feed});
};

rdr.feed._updatePutOnError = function(callback, feed, event) {
  console.error(event.target.error);
  callback({'type': 'error', 'feed': feed});
};

rdr.feed.add = function(db, feed, callback) {

  if('id' in feed) {
    throw new Error('feed should never have an id property');
  }

  const urlString = rdr.feed.getURL(feed);
  if(!urlString) {
    throw new Error('feed should always have at least one url');
  }

  console.debug('Adding feed', urlString);

  const sanitizedFeed = rdr.feed.sanitize(feed);
  sanitizedFeed.dateCreated = new Date();
  const storableFeed = rdr.filterUndefProps(sanitizedFeed);
  const transaction = db.transaction('feed', 'readwrite');
  const store = transaction.objectStore('feed');
  const request = store.add(storableFeed);
  if(callback) {
    request.onsuccess = rdr.feed._addOnSuccess.bind(request, storableFeed,
      callback);
    request.onerror = rdr.feed._addOnError.bind(request, storableFeed,
      callback);
  }
}

rdr.feed._addOnSuccess = function(feed, callback, event) {
  feed.id = event.target.result;
  callback({'type': 'success', 'feed': feed});
};

rdr.feed._addOnError = function(feed, callback, event) {
  console.error(event.target.error);
  callback({'type': event.target.error.name});
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
