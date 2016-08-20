// Copyright 2016 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

// Creates a new Feed object with cleaned fields. This checks for invalid values
// and tries to minimize XSS vulnerables in html strings.
function sanitize_feed(inputFeed) {
  // Copy to maintain all the fields and purity
  const feed = Object.assign(new Feed(), inputFeed);

  // If id is defined it should be a positive integer
  if(feed.id) {
    console.assert(!isNaN(feed.id));
    console.assert(isFinite(feed.id));
    console.assert(feed.id > 0);
  }

  // If type is defined it should be one of the allowed types
  const types = {'feed': 1, 'rss': 1, 'rdf': 1};
  if(feed.type) {
    console.assert(feed.type in types, 'invalid type', feed.type);
  }

  // Sanitize feed title. title is an HTML string
  if(feed.title) {
    let title = feed.title;
    title = filter_control_chars(title);
    title = replace_html(title, '');
    title = title.replace(/\s+/, ' ');
    title = truncate_html(title, 1024, '');
    title = title.trim();
    feed.title = title;
  }

  // Sanitize feed description. description is an HTML string
  if(feed.description) {
    let description = feed.description;
    description = filter_control_chars(description);
    description = replace_html(description, '');

    // Condense and transform whitespace into a single space
    description = description.replace(/\s+/, ' ');

    // Enforce a maximum storable length
    const lengthBeforeTruncation = description.length;
    const DESCRIPTION_MAX_LENGTH = 1024 * 10;
    description = truncate_html(description, DESCRIPTION_MAX_LENGTH, '');
    if(lengthBeforeTruncation > description.length) {
      console.warn('Truncated description', description);
    }

    description = description.trim();
    feed.description = description;
  }

  return feed;
}
