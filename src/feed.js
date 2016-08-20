// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to a feed database object. indexedDB cannot store this
// object directly because it is a function object.
function Feed() {
  // The date the feed was first stored in the database
  this.dateCreated = null;
  // The date the feed's remote xml file was last fetched
  this.dateFetched = null;
  // The last modified header value as a date from the response to fetching
  // the feed's remote xml file
  this.dateLastModified = null;
  // The feed's own supposed date published, according to the feed's own
  // internal xml values
  this.datePublished = null;
  // The date the feed was last changed in the database
  this.dateUpdated = null;
  // html string derived from contents of feed, optional
  this.description = null;
  // url string pointing to the feed's favicon
  this.faviconURLString = null;
  // url object (not string!) pointing to the feed's associated website url
  this.link = null;
  // html string derived from contents of feed
  this.title = null;
  // string, internal feed, represents feed's format (e.g. rss or atom)
  this.type = null;
  // an array of URL objects. Treat as a set, meaning its values should all be
  // unique. The set is ordered, meaning it is a sorted set, and is sorted by
  // insertion order. The urls list maintains a history of the urls of a feed.
  // For example, if a redirect occurs, then the new url is appended after the
  // prior url. All feeds should have at least one url.
  this.urls = null;
}

// Gets the terminal url, which is the last url out of the feed's list of urls
Feed.prototype.get_url = function() {
  if(Feed.prototype.has_url.call(this)) {
    return this.urls[this.urls.length - 1];
  }
};

// Returns true if the feed has an associated url
Feed.prototype.has_url = function() {
  return this.urls && this.urls.length;
};

// Adds the url to the feed (if it is unique from prior urls)
Feed.prototype.add_url = function(url) {

  console.assert(Object.prototype.toString.call(url) === '[object URL]',
    'url must be a URL object', url);

  // Lazily create the array
  if(!this.urls) {
    this.urls = [];
  }

  // Search for the url in the existing set. Compare by normalized values.
  // Converting the URL object to a string implictly normalizes.
  const url_string = url.href;
  const matching_url = this.urls.find(function(url) {
    return url.href === url_string;
  });

  if(matching_url) {
    return;
  }

  // Clone the url. URL objects are mutable, and we want to make sure that the
  // side effect of setting a property of the URL object parameter externally
  // doesn't affect the object stored in the urls array here.
  const cloned_url = new URL(url_string);

  // Add the unique clone. The set is ordered, so the most recent URL should
  // be at the end.
  this.urls.push(cloned_url);
};
