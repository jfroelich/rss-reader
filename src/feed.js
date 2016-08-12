// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to a feed database object. indexedDB cannot store this
// object directly because it is a function object.
// @param serializedFeed {Object} a serialized form of a feed object, optional,
// if set then deserializes the serialized feed into this feed's properties
function Feed(serializedFeed) {
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
  // An optional array of Entry objects from the last fetch
  this.entries = null;

  // If the serializedFeed parameter is defined, then copy over the values of
  // the  fields from the parameter into this instance's fields' values, and
  // do any deserialization needed (e.g. convert url strings to URL objects)
  if(serializedFeed) {
    this.deserialize(serializedFeed);
  }
}

// Updates this object's properties from the serialized feed parameter
Feed.prototype.deserialize = function(feed) {
  Object.assign(this, feed);

  // Deserialize urls. indexedDB cannot store URL objects, so when loading
  // an object from the store, we have to convert back from strings to urls.
  // This assumes urls are always valid and never throws.
  // This assumes the urls are unique and properly ordered.
  if(feed.urls && feed.urls.length) {
    this.urls = feed.urls.map(function(urlString) {
      return new URL(urlString);
    });
  }

  if(feed.link) {
    this.link = new URL(feed.link);
  }
};

// Gets the terminal url, which is the last url out of the feed's list of urls
Feed.prototype.getURL = function() {
  if(Feed.prototype.hasURL.call(this)) {
    return this.urls[this.urls.length - 1];
  }
};

// Returns true if the feed has an associated url
Feed.prototype.hasURL = function() {
  return this.urls && this.urls.length;
};

// Adds the url to the feed (if it is unique from prior urls)
Feed.prototype.addURL = function(url) {

  console.assert(Object.prototype.toString.call(url) === '[object URL]',
    'url must be a URL object', url);

  // Lazily create the array
  if(!this.urls) {
    this.urls = [];
  }

  // Search for the url in the existing set. Compare by normalized values.
  // Converting the URL object to a string implictly normalizes.
  const urlString = url.href;
  const matchingURL = this.urls.find(function(urlObj) {
    return urlObj.href === urlString;
  });

  if(matchingURL) {
    return;
  }

  // Clone the url. URL objects are mutable, and we want to make sure that the
  // side effect of setting a property of the URL object parameter externally
  // doesn't affect the object stored in the urls array here.
  const clonedURL = new URL(urlString);

  // Add the unique clone. The set is ordered, so the most recent URL should
  // be at the end.
  this.urls.push(clonedURL);
};

Feed.prototype.addEntry = function(entry) {
  if(!this.entries) {
    this.entries = [];
  }

  this.entries.push(entry);
};

Feed.prototype.getEntries = function() {
  return this.entries;
};

// Returns a new Feed of this feed merged with another feed. Fields from the
// other feed take precedence, except for URLs, which are merged to generate a
// distinct ordered set, where the other urls appear after this feed's urls.
// No serialization or sanitization occurs.
Feed.prototype.merge = function(otherFeed) {

  // Clone to maintain purity. No operations here should affect this object or
  // the otherFeed.
  const mergedFeed = Object.assign(new Feed(), this);

  // The copy operations are listed mostly in alphabetical order of field name,
  // there is no logical signifiance
  if(otherFeed.description) {
    mergedFeed.description = otherFeed.description;
  }

  // TODO: this needs to clone entry objects to ensure purity?
  // This merely clones the array.
  if(otherFeed.entries) {
    mergedFeed.entries = [...otherFeed.entries];
  }

  // TODO: do I need to clone dates or are dates immutable?
  if(otherFeed.dateCreated) {
    mergedFeed.dateCreated = otherFeed.dateCreated;
  }

  if(otherFeed.dateFetched) {
    mergedFeed.dateFetched = otherFeed.dateFetched;
  }

  if(otherFeed.dateLastModified) {
    mergedFeed.dateLastModified = otherFeed.dateLastModified;
  }

  if(otherFeed.datePublished) {
    mergedFeed.datePublished = otherFeed.datePublished;
  }

  if(otherFeed.dateUpdated) {
    mergedFeed.dateUpdated = otherFeed.dateUpdated;
  }

  if(otherFeed.faviconURLString) {
    mergedFeed.faviconURLString = otherFeed.faviconURLString;
  }

  if(otherFeed.link) {
    mergedFeed.link = new URL(otherFeed.link.href);
  }

  if(otherFeed.title) {
    mergedFeed.title = otherFeed.title;
  }

  if(otherFeed.type) {
    mergedFeed.type = otherFeed.type;
  }

  // Merge url objects. addURL will ensure uniqueness/purity.
  for(let url of otherFeed.urls) {
    mergedFeed.addURL(url);
  }

  return mergedFeed;
};

// Generates a new basic object suitable for storage in indexedDB.
// The entries property is excluded.
Feed.prototype.serialize = function() {

  // We have to copy over individual properties instead of simply cloning in
  // order to avoid expando properties. We also want to avoid setting a key when
  // its value is null or undefined.
  const feed = {};

  // Date objects are mutable, so to ensure purity, date objects are cloned.
  if(this.dateFetched) {
    feed.dateFetched = new Date(this.dateFetched.getTime());
  }

  if(this.datePublished) {
    feed.datePublished = new Date(this.datePublished.getTime());
  }

  if(this.dateCreated) {
    feed.dateCreated = new Date(this.dateCreated.getTime());
  }

  if(this.dateLastModified) {
    feed.dateLastModified = new Date(this.dateLastModified.getTime());
  }

  if(this.dateUpdated) {
    feed.dateUpdated = new Date(this.dateUpdated.getTime());
  }

  if(this.description) {
    feed.description = this.description;
  }

  if(this.faviconURLString) {
    feed.faviconURLString = this.faviconURLString;
  }

  // id is optional because it isn't present when adding but is when updating
  // We have to be extra careful not to define it in the case of an add in
  // order to avoid an error when inserting into the database.
  if(this.id) {
    feed.id = this.id;
  }

  // Link is a URL object so we must convert it to a string
  if(this.link) {
    feed.link = this.link.toString();
  }

  if(this.title) {
    feed.title = this.title;
  } else {
    // To ensure it is indexed because this is currently required by the
    // view implementation
    feed.title = '';
  }

  if(this.type) {
    feed.type = this.type;
  }

  // Convert urls to strings, maintaining collection order
  feed.urls = this.urls.map(function(url) {
    return url.toString();
  });

  return feed;
};

// Creates a new Feed object with cleaned fields. This checks for invalid values
// and tries to minimize XSS vulnerables in html strings. Values should be
// sanitized before storage, the view assumes it uses sanitized values.
Feed.prototype.sanitize = function() {
  // Copy to maintain all the fields and purity
  const feed = Object.assign(new Feed(), this);

  // If id is defined it should be a positive integer
  if(feed.id) {
    console.assert(!isNaN(feed.id), 'id is nan', feed.id);
    console.assert(isFinite(feed.id), 'id not finite', feed.id);
    console.assert(feed.id > 0, 'id negative or 0', feed.id);
  }

  // If type is defined it should be one of the allowed types
  const allowedTypes = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type) {
    console.assert(feed.type in allowedTypes, 'invalid type', feed.type);
  }

  // Sanitize feed title. title is an HTML string
  if(feed.title) {
    let title = feed.title;
    title = StringUtils.filterControlCharacters(title);
    title = StringUtils.replaceHTML(title, '');
    title = title.replace(/\s+/, ' ');
    title = StringUtils.truncateHTML(title, 1024, '');
    title = title.trim();
    feed.title = title;
  }

  // Sanitize feed description. description is an HTML string
  if(feed.description) {
    let description = feed.description;
    description = StringUtils.filterControlCharacters(description);
    description = StringUtils.replaceHTML(description, '');

    // Condense and transform whitespace into a single space
    description = description.replace(/\s+/, ' ');

    // Enforce a maximum storable length
    const lengthBeforeTruncation = description.length;
    const DESCRIPTION_MAX_LENGTH = 1024 * 10;
    description = StringUtils.truncateHTML(description,
      DESCRIPTION_MAX_LENGTH, '');
    if(lengthBeforeTruncation > description.length) {
      console.warn('Truncated description', description);
    }

    description = description.trim();
    feed.description = description;
  }

  return feed;
};
