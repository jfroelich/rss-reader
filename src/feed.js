// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Corresponds to a feed database object. Because indexedDB cannot store such
// objects, this is generally only intended to provide prototype members that
// can correctly operate on objects loaded from the database

function Feed() {}

// Gets the terminal url, which is the last url out of the feed's list of urls
Feed.prototype.getURL = function() {
  return this.urls[this.urls.length - 1];
};

Feed.prototype.addURL = function(urlString) {
  if(!this.urls) {
    this.urls = [];
  }

  // Ensure the url does not already exist
  if(!this.urls.includes(urlString)) {
    this.urls.push(urlString);
  }
};

// Returns a new feed merged with another feed. Expects both feeds in
// serialized form. Fields from the other feed take precedence, so when there
// is a value in both this and the other feed, the other fields value is what
// appears in the output. Except for urls, where only distinct urls are kept
// and the order is this feed's urls then any urls from the other feed not
// already present. Also except for id, the local feed id if present is
// kept, and the other feed's id is ignored.
Feed.prototype.merge = function(otherFeed) {

  // Clone ourself to maintain purity.
  const mergedFeed = Object.assign({}, this);

  // Merge the url lists of both feeds
  if(mergedFeed.urls && otherFeed.urls) {
    for(let url of otherFeed.urls) {
      if(!mergedFeed.urls.includes(url)) {
        mergedFeed.urls.push(url);
      }
    }
  } else if(otherFeed.urls) {
    mergedFeed.urls = [];
    for(let url of otherFeed.urls) {
      mergedFeed.urls.push(url);
    }
  }

  if(otherFeed.title) {
    mergedFeed.title = otherFeed.title;
  }

  if(otherFeed.description) {
    mergedFeed.description = otherFeed.description;
  }

  if(otherFeed.link) {
    mergedFeed.link = otherFeed.link;
  }

  if(otherFeed.faviconURLString) {
    mergedFeed.faviconURLString = otherFeed.faviconURLString;
  }

  if(otherFeed.datePublished) {
    mergedFeed.datePublished = otherFeed.datePublished;
  }

  if(otherFeed.dateFetched) {
    mergedFeed.dateFetched = otherFeed.dateFetched;
  }

  if(otherFeed.dateLastModified) {
    mergedFeed.dateLastModified = otherFeed.dateLastModified;
  }

  return mergedFeed;
};


// Generates a new basic object suitable for storage in indexedDB from within
// the context of either adding a new feed or updating an existing feed
// Does not sanitize. This merely ensures that only storable
// values are present in the object.
Feed.prototype.serialize = function() {

  const outputFeed = {};

  // The id will be defined in the update context but not in the add context
  if(this.id) {
    outputFeed.id = this.id;
  }

  if(this.type) {
    outputFeed.type = this.type;
  }

  // Convert urls to strings
  if(this.urls && this.urls.length) {
    if(Object.prototype.toString.call(this.urls[0]) === '[object URL]') {
      outputFeed.urls = this.urls.map(function(url) {
        return url.href;
      });
    } else {
      // clone in order to maintain purity
      outputFeed.urls = [...this.urls];
    }
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
