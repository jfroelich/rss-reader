// Copyright 2014 Josh Froelich. All rights reserved.
// Use of this source code is governed by a MIT-style license
// that can be found in the LICENSE file

'use strict';

var lucu = lucu || {};
lucu.feed = lucu.feed || {};

/**
 * Returns a sanitized version of a feed object.
 * The object is not modified. Only certain
 * properties are sanitized and included in the returned object
 * TODO: deal with html entities
 */
lucu.feed.sanitize = function(dirtyFeed) {
  var cleanFeed = {};

  var title = lucu.feed.sanitizeProp(dirtyFeed.title);
  if(title) {
    cleanFeed.title = title;
  }

  var description = lucu.feed.sanitizeProp(dirtyFeed.description);
  if(description) {
    cleanFeed.description = description;
  }

  var link = lucu.feed.sanitizeProp(dirtyFeed.link);
  if(link) {
    cleanFeed.link = link;
  }

  if(feed.date) {
    cleanFeed.date = dirtyFeed.date;
  }

  return cleanFeed;
};

/**
 * TODO: should we replace HTML entities after
 * stripping tags? Some entities? All entities?
 *
 * TODO: does this function belong somewhere else?
 */
lucu.feed.sanitizeProp = function(str) {

  if(!str) {
    return;
  }

  str = lucu.string.stripTags(str);

  if(str) {
    str = lucu.string.stripControls(str);
  }

  // TODO: this should be a call to a separate function
  // or maybe merged with lucu.string.stripControls
  // (one pass instead of two)
  if(str) {
    str = str.replace(/\s+/,' ');
  }

  // If there is anything left in the string, trim it.
  if(str) {
    str = str.trim();
  }

  return str;
};
