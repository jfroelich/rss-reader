// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Returns a new Feed of this feed merged with another feed. Fields from the
// other feed take precedence, except for URLs, which are merged to generate a
// distinct ordered set, where the other urls appear after this feed's urls.
// No serialization or sanitization occurs.
function merge_feeds(thisFeed, otherFeed) {

  // Clone to maintain purity. No operations here should affect this object or
  // the otherFeed.
  const mergedFeed = Object.assign(new Feed(), thisFeed);

  // The copy operations are listed mostly in alphabetical order of field name,
  // there is no logical signifiance
  if(otherFeed.description) {
    mergedFeed.description = otherFeed.description;
  }

  // TODO: this needs to clone entry objects to ensure purity?
  // This merely clones the array
  // maybe this shouldn't even be included
  // which means maybe entries shouldn't even be a feed property
  if(otherFeed.entries) {
    mergedFeed.entries = [...otherFeed.entries];
  }

  // TODO: properly clone dates
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

  // Merge url objects. add_url will ensure uniqueness/purity.
  for(let url of otherFeed.urls) {
    mergedFeed.add_url(url);
  }

  return mergedFeed;
}
