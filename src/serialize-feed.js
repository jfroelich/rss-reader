// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Generates a new basic object suitable for storage in indexedDB.
//
// @param inputFeed {Feed} the Feed function object to serialize
// @returns {Object} the serialized feed basic object
function serialize_feed(inputFeed) {

  // We have to copy over individual properties instead of simply cloning in
  // order to avoid expando properties. We also want to avoid setting a key when
  // its value is null or undefined.
  const feed = {};

  // Date objects are mutable, so to ensure purity, date objects are cloned.
  if(inputFeed.dateFetched) {
    feed.dateFetched = new Date(inputFeed.dateFetched.getTime());
  }

  if(inputFeed.datePublished) {
    feed.datePublished = new Date(inputFeed.datePublished.getTime());
  }

  if(inputFeed.dateCreated) {
    feed.dateCreated = new Date(inputFeed.dateCreated.getTime());
  }

  if(inputFeed.dateLastModified) {
    feed.dateLastModified = new Date(inputFeed.dateLastModified.getTime());
  }

  if(inputFeed.dateUpdated) {
    feed.dateUpdated = new Date(inputFeed.dateUpdated.getTime());
  }

  if(inputFeed.description) {
    feed.description = inputFeed.description;
  }

  if(inputFeed.faviconURLString) {
    feed.faviconURLString = inputFeed.faviconURLString;
  }

  // id is optional because it isn't present when adding but is when updating
  // We have to be extra careful not to define it in the case of an add in
  // order to avoid an error when inserting into the database.
  if(inputFeed.id) {
    feed.id = inputFeed.id;
  }

  // Link is a URL object so we must convert it to a string
  if(inputFeed.link) {
    feed.link = inputFeed.link.toString();
  }

  if(inputFeed.title) {
    feed.title = inputFeed.title;
  } else {
    // To ensure it is indexed because this is currently required by the
    // view implementation
    feed.title = '';
  }

  if(inputFeed.type) {
    feed.type = inputFeed.type;
  }

  // Convert urls to strings, maintaining collection order
  feed.urls = inputFeed.urls.map(function(url) {
    return url.toString();
  });

  return feed;
}
