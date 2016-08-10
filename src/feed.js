// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to a feed database object. Because indexedDB cannot store such
// objects directly, this is only intended to provide prototype members that
// can correctly operate on serialized objects loaded from the database
// @param serializedFeed {Object} a serialized form of a feed object, optional,
// if set then deserializes the serialized feed into this feed's properties
function Feed(serializedFeed) {
  this.dateCreated = null;
  this.dateFetched = null;
  this.dateLastModified = null;
  this.datePublished = null;
  this.dateUpdated = null;
  this.description = null;
  this.faviconURLString = null;
  this.link = null;
  this.title = null;
  this.type = null;
  this.urls = null;
  this.entries = null;

  if(serializedFeed) {
    this.deserialize(serializedFeed);
  }
}

// Updates this object's properties from the serialized feed parameter
Feed.prototype.deserialize = function(feed) {
  Object.assign(this, feed);

  // Deserialize urls. indexedDB cannot store URL objects.
  // This assumes urls are always valid and never throws.
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
// TODO: this needs to be refactored to only accept a URL object, and clone
// the url when setting, and then refactor merge to use it, and all
// dependencies
Feed.prototype.addURL = function(urlString) {

  console.assert(urlString, 'urlString is required');

  if(!this.urls) {
    this.urls = [];
  }

  // Ensure the url does not already exist
  // Assume comparing normalized versions of urls
  if(!this.urls.includes(urlString)) {
    this.urls.push(urlString);
  }
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
// distinct set. No serialization or sanitization occurs.
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

  // TODO: if link is a URL object, shouldn't I be cloning it?
  if(otherFeed.link) {
    mergedFeed.link = otherFeed.link;
  }

  if(otherFeed.title) {
    mergedFeed.title = otherFeed.title;
  }

  if(otherFeed.type) {
    mergedFeed.type = otherFeed.type;
  }

  // TODO: I should define two methods, addURL and addURLString. addURL
  // implicitly does the exists check, so there is no need to do it twice here.
  // In fact this is silly the way I am doing it now.
  // Also, for addURL, I need to clone.
  // Or, I should change addURL to expect a URL object. That probably makes
  // more sense. To do that I need to check all calls to addURL.
  // Right now this is abusing addURL which expects a string, specifically
  // the fact that it doesn't check its argument type

  // When copying over a URL, clone it to ensure purity. Otherwise,
  // setting a property of a URL in otherFeed would set the property
  // of a URL in the merged feed.

  // Merge the url lists of both feeds. Both arrays should contain URL objects
  // Ensure uniqueness. At the start of this, mergedFeed contains the url
  // objects present in this feed.
  if(mergedFeed.urls && otherFeed.urls) {
    for(let otherURL of otherFeed.urls) {
      let exists = false;
      for(let localURL of mergedFeed.urls) {
        if(localURL.href === otherURL.href) {
          exists = true;
          break;
        }
      }

      if(!exists) {
        mergedFeed.addURL(new URL(otherURL.href));
      }
    }
  } else if(otherFeed.urls) {
    // Copy over the other feed's urls without doing a lookup.
    for(let otherURL of otherFeed.urls) {
      mergedFeed.addURL(new URL(otherURL.href));
    }
  }

  return mergedFeed;
};

// Generates a new basic object suitable for storage in indexedDB.
// Does not sanitize. This merely ensures that only storable
// values are present in the object.
// The entries property is excluded.
Feed.prototype.serialize = function() {

  // We have to copy over individual properties instead of simply cloning in
  // order to avoid expando properties. We also want to avoid setting a key when
  // its value is null or undefined.
  const outputFeed = {};

  // id is optional because it isn't present when adding but is when updating
  // We have to be extra careful not to define it in the case of an add in
  // order to avoid an error when inserting into the database.
  if(this.id) {
    outputFeed.id = this.id;
  }

  if(this.type) {
    outputFeed.type = this.type;
  }

  // Convert urls to strings
  if(Object.prototype.toString.call(this.urls[0]) === '[object URL]') {
    outputFeed.urls = this.urls.map(function urlToString(url) {
      return url.href;
    });
  } else {
    // clone in order to maintain purity
    outputFeed.urls = [...this.urls];
  }

  if(this.title) {
    outputFeed.title = this.title;
  } else {
    // To ensure it is indexed because this is currently required by the
    // view implementation
    outputFeed.title = '';
  }

  if(this.description) {
    outputFeed.description = this.description;
  }

  if(this.link) {
    if(Object.prototype.toString.call(this.link) === '[object URL]') {
      outputFeed.link = this.link.href;
    } else {
      outputFeed.link = this.link;
    }
  }

  if(this.faviconURLString) {
    outputFeed.faviconURLString = this.faviconURLString;
  }

  // TODO: do I need to clone dates to ensure purity?
  // if things like Date.prototype.setDay or whatever exist, then yes

  if(this.dateFetched) {
    outputFeed.dateFetched = this.dateFetched;
  }

  if(this.datePublished) {
    outputFeed.datePublished = this.datePublished;
  }

  if(this.dateCreated) {
    outputFeed.dateCreated = this.dateCreated;
  }

  if(this.dateLastModified) {
    outputFeed.dateLastModified = this.dateLastModified;
  }

  if(this.dateUpdated) {
    outputFeed.dateUpdated = this.dateUpdated;
  }

  return outputFeed;
};

// Creates a new feed suitable for storage
// TODO: set upper bound on storable string length using truncateHTMLString
Feed.prototype.sanitize = function() {
  // Copy to maintain all the fields and purity
  const feed = Object.assign(new Feed(), this);

  // If id is defined it should be a positive integer
  if(feed.id) {
    console.assert(!isNaN(feed.id), 'nan id', feed.id);
    console.assert(feed.id > 0, 'non-positive id', feed.id);
  }

  // If type is defined it should be one of the allowed types
  if(feed.type) {
    const allowedTypes = {'feed': 1, 'rss': 1, 'rdf': 1};
    console.assert(feed.type in allowedTypes, 'invalid type', feed.type);
  }

  // Sanitize feed title. The title is an HTML string. However, we only want to
  // allow entities, not tags.
  if(feed.title) {
    let title = feed.title;
    title = StringUtils.filterControlCharacters(title);
    title = StringUtils.replaceHTML(title, '');
    title = title.replace(/\s+/, ' ');
    title = title.trim();
    feed.title = title;
  }

  // Sanitize feed description
  if(feed.description) {
    let description = feed.description;
    description = StringUtils.filterControlCharacters(description);
    description = StringUtils.replaceHTML(description, '');
    description = description.replace(/\s+/, ' ');
    description = description.trim();
    feed.description = description;
  }

  return feed;
};
