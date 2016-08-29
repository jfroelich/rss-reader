// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

{ // Begin file block scope

// Returns a new Feed of this feed merged with another feed. Fields from the
// other feed take precedence, except for URLs, which are merged to generate a
// distinct ordered set, where the other urls appear after this feed's urls.
// No serialization or sanitization occurs.
this.merge_feeds = function(this_feed, other_feed) {

  // Clone to maintain purity. No operations here should affect this object or
  // the other_feed.
  const merged_feed = Object.assign(new Feed(), this_feed);

  // The copy operations are listed mostly in alphabetical order of field name,
  // there is no logical signifiance
  if(other_feed.description) {
    merged_feed.description = other_feed.description;
  }

  if(other_feed.dateCreated) {
    merged_feed.dateCreated = clone_date(other_feed.dateCreated);
  }

  if(other_feed.dateFetched) {
    merged_feed.dateFetched = clone_date(other_feed.dateFetched);
  }

  if(other_feed.dateLastModified) {
    merged_feed.dateLastModified = clone_date(other_feed.dateLastModified);
  }

  if(other_feed.datePublished) {
    merged_feed.datePublished = clone_date(other_feed.datePublished);
  }

  if(other_feed.dateUpdated) {
    merged_feed.dateUpdated = clone_date(other_feed.dateUpdated);
  }

  if(other_feed.faviconURLString) {
    merged_feed.faviconURLString = other_feed.faviconURLString;
  }

  if(other_feed.link) {
    merged_feed.link = clone_url(other_feed.link);
  }

  if(other_feed.title) {
    merged_feed.title = other_feed.title;
  }

  if(other_feed.type) {
    merged_feed.type = other_feed.type;
  }

  // Merge url objects. add_url will ensure uniqueness/purity.
  for(let url of other_feed.urls) {
    merged_feed.add_url(url);
  }

  return merged_feed;
};

function clone_url(url) {
  return new URL(url.href);
}

function clone_date(date) {
  return new Date(date.getTime());
}

} // End file block scope
