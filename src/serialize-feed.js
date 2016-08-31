// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Generates a new basic object suitable for storage in indexedDB.
//
// @param input_feed {Feed} the Feed function object to serialize
// @returns {Object} the serialized feed basic object
function serialize_feed(input_feed) {

  // We have to copy over individual properties instead of simply cloning in
  // order to avoid expando properties. We also want to avoid setting a key when
  // its value is null or undefined.
  const feed = {};

  // Date objects are mutable, so to ensure purity, date objects are cloned.
  if(input_feed.dateFetched) {
    feed.dateFetched = new Date(input_feed.dateFetched.getTime());
  }

  if(input_feed.datePublished) {
    feed.datePublished = new Date(input_feed.datePublished.getTime());
  }

  if(input_feed.dateCreated) {
    feed.dateCreated = new Date(input_feed.dateCreated.getTime());
  }

  if(input_feed.dateLastModified) {
    feed.dateLastModified = new Date(input_feed.dateLastModified.getTime());
  }

  if(input_feed.dateUpdated) {
    feed.dateUpdated = new Date(input_feed.dateUpdated.getTime());
  }

  if(input_feed.description) {
    feed.description = input_feed.description;
  }

  if(input_feed.faviconURLString) {
    feed.faviconURLString = input_feed.faviconURLString;
  }

  // id is optional because it isn't present when adding but is when updating
  // We have to be extra careful not to define it in the case of an add in
  // order to avoid an error when inserting into the database.
  if(input_feed.id) {
    feed.id = input_feed.id;
  }

  // Link is a URL object so we must convert it to a string
  if(input_feed.link) {
    feed.link = input_feed.link.toString();
  }

  if(input_feed.title) {
    feed.title = input_feed.title;
  } else {
    // To ensure it is indexed because this is currently required by the
    // view implementation
    feed.title = '';
  }

  if(input_feed.type) {
    feed.type = input_feed.type;
  }

  // Convert urls to strings, maintaining collection order
  feed.urls = input_feed.urls.map(function(url) {
    return url.toString();
  });

  return feed;
}
