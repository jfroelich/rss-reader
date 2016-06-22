// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// A Feed object is an in memory object that represents a feed
function Feed() {

  // Integer, uniquely distinguishes the feed and provides a simple handle
  // to pass around and use in the UI. Greater than 0.
  // Required except when creating a new feed
  this.id = null;

  // An array of URL objects. Unique. Uses URL objects so all absolute urls.
  // A URL should point to the location of an xml file representing a feed.
  // Required.
  this.urls = [];

  // A simple string identifier of the feed's type. This should contain
  // just 'rss', 'rdf', or 'feed'
  // Optional.
  this.type = null;

  // A plaintext title. May contain html entities, but should never contain
  // tags.
  // Optional.
  this.title = null;

  // Similar to title
  // Optional.
  this.description = null;

  // A single URL object representing a website associated with the feed
  // Optional.
  this.linkURL = null;

  // A Date object representing when the feed was last published.
  // TODO: currently corresponds to the field 'feed.date' in other places
  // in the code, but I plan to change this. Also, the other places may be
  // using something other than a date type.
  this.datePublished = null;

  // Date the feed was first stored in indexedDB.
  // Date.
  // TODO: other areas need to rename and use this.
  this.dateCreated = null;

  // Date the feed was last updated and stored in indexedDB.
  // Date
  // TODO: other areas need to rename and use this.
  this.dateUpdated = null;

  // Date. When the feed was last fetched.
  // Optional
  this.dateFetched = null;

  // Date. When the feed's xml file was last modified.
  // Optional
  this.dateLastModified = null;
}

Feed.TYPE_RSS = 'rss';
Feed.TYPE_RDF = 'rdf';
Feed.TYPE_ATOM = 'feed';

Feed.prototype.addURLString = function(urlString) {
  try {
    return this.addURL(new URL(urlString));
  } catch(exception) {
    console.debug(exception);
  }
  return false;
};

// Adds a url to the urls property
Feed.prototype.addURL = function(url) {

  // NOTE: I am comparing strings because I ran into an unclear issue
  // with comparing URL objects for equality. This is also part of the reason
  // that this.urls is an array and not a Set.

  // NOTE: I have not tested whether URL.toString works like URL.href, even
  // though moz docs says it does

  function toString(value) {
    return value.toString();
  }

  const urlStrings = this.urls.map(toString);
  if(urlStrings.includes(url.href)) {
    return false;
  }

  this.urls.push(url);
  return true;
};

// Returns the current URL object (the last of the URLs in the urls property)
Feed.prototype.getURL = function() {
  const length = this.urls.length;
  return length ? this.urls[length - 1] : null;
};

// Creates and returns a simple js object suitable for indexedDB storage.
Feed.prototype.toSerializable = function() {
  const feed = Object.create(null);

  // This may be an object that has never been stored, so allow for
  // a missing id
  if(this.id) {
    feed.id = this.id;
  }

  // indexedDB cannot store url objects, so store them as strings.
  feed.urls = this.urls.map(function(url) {
    return url.href;
  });

  if(this.linkURL) {
    // TODO: rename
    feed.link = this.linkURL.href;
  }

  feed.type = this.type;
  // NOTE: I don't want to do this but due to how the options page sorts
  // by title index and the feed will not otherwise appear in the title index
  // i have to at least provide an empty string. In the future I would like
  // to remove this.
  feed.title = this.title || '';
  feed.description = this.description;
  feed.datePublished = this.datePublished;
  feed.dateCreated = this.dateCreated;
  feed.dateUpdated = this.dateUpdated;
  feed.dateFetched = this.dateFetched;
  feed.dateLastModified = this.dateLastModified;

  return feed;
};

// Creates and returns a new Feed object given a serialized feed object loaded
// from indexedDB.
Feed.fromSerializable = function(serializedFeed) {

  const feed = new Feed();
  feed.id = serializedFeed.id;
  feed.title = serializedFeed.title;
  feed.description = serializedFeed.description;
  feed.type = serializedFeed.type;

  // No try catch because we trust the input
  if(serializedFeed.link) {
    feed.linkURL = new URL(serializedFeed.link);
  }

  // Create urls. Do not call addURL because we want to skip the uniqueness
  // check because we trust the input
  feed.urls = serializedFeed.urls.map(function(urlString) {
    return new URL(urlString);
  });

  // TODO: this is wrong, some of these are not dates
  feed.datePublished = serializedFeed.date;
  feed.dateCreated = serializedFeed.created;
  feed.dateUpdated = serializedFeed.updated;
  feed.dateLastModified = serializedFeed.dateLastModified;

  return feed;
};
